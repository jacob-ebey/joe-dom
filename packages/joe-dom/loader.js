import * as acorn from "acorn-loose";

const DIRTY_CHECK = /(['"])use (client|server)(['"])/g;

/**
 * @param {string} source
 */
export function clientModuleTransform(source, moduleId) {
  const match = source.match(DIRTY_CHECK);
  if (!match || match[1] !== match[3]) {
    return { useClient: false, useServer: false, source };
  }

  const tree = acorn.parse(source, {
    ecmaVersion: "latest",
  });

  let useClient = false;
  let useServer = false;
  let defaultName;
  const exportNames = [];
  for (const node of tree.body) {
    switch (node.type) {
      case "ExpressionStatement": {
        if (node.directive === "use client") {
          useClient = true;
        } else if (node.directive === "use server") {
          useServer = true;
        }
        break;
      }
      case "ExportNamedDeclaration": {
        if (node.source) {
          throw new Error("Export from not supported");
        }
        if (Array.isArray(node.specifiers)) {
          for (const specifier of node.specifiers) {
            if (specifier.exported.name) {
              exportNames.push(specifier.exported.name);
            }
          }
        }
        if (Array.isArray(node.declaration?.declarations)) {
          for (const declaration of node.declaration.declarations) {
            if (declaration.id?.name) {
              exportNames.push(declaration.id.name);
            }
          }
        }
        break;
      }
      case "ExportDefaultDeclaration": {
        if (!node?.declaration?.name) {
          throw new Error("Default exports must be named");
        }
        defaultName = node.declaration.name;
        exportNames.push("default");
        break;
      }
      case "ExportAllDeclaration": {
        throw new Error("Export all not supported");
      }
      case "ExportSpecifier": {
        exportNames.push(node.exported.name);
        break;
      }
    }
  }

  if (!useClient && !useServer) {
    return { useClient: false, useServer: false, source };
  }
  if (useClient && useServer) {
    throw new Error(
      "Cannot both 'use client' and 'use server' in the same module"
    );
  }

  if (useServer) {
    let str = `import {SERVER_SYMBOL} from "joe-dom";\n`;

    for (const name of exportNames) {
      const exp = `{$$typeof:SERVER_SYMBOL,$$id:${JSON.stringify(
        `${moduleId}#${name}`
      )}}`;
      if (name === "default") {
        str += `export default ${exp};\n`;
      } else {
        str += `export const ${name} = ${exp};\n`;
      }
    }

    return {
      useClient: false,
      useServer: true,
      exportNames,
      defaultName,
      source: str,
    };
  }

  let str = (source += "\n");

  for (let name of exportNames) {
    if (name === "default") {
      name = defaultName;
    }
    str += `if (typeof ${name} === "function")`;
    str += `Object.defineProperties(${name}, {`;
    str += `$$typeof: { value: Symbol.for("joe-dom.client") },`;
    str += `$$id: { value: ${JSON.stringify(`${moduleId}#${name}`)} }`;
    str += "})";
  }
  return {
    useClient: true,
    useServer: false,
    exportNames,
    defaultName,
    source: str,
  };
}

/**
 * @param {string} source
 */
export function serverModuleTransform(source, moduleId) {
  const match = source.match(DIRTY_CHECK);
  if (!match || match[1] !== match[3]) {
    return { useClient: false, useServer: false, source };
  }

  const tree = acorn.parse(source, {
    ecmaVersion: "latest",
  });

  let useClient = false;
  let useServer = false;
  let defaultName;
  const exportNames = [];
  for (const node of tree.body) {
    switch (node.type) {
      case "ExpressionStatement": {
        if (node.directive === "use client") {
          useClient = true;
        } else if (node.directive === "use server") {
          useServer = true;
        }
        break;
      }
      case "ExportNamedDeclaration": {
        if (node.source) {
          throw new Error("Export from not supported");
        }
        if (Array.isArray(node.specifiers)) {
          for (const specifier of node.specifiers) {
            if (specifier.exported.name) {
              exportNames.push(specifier.exported.name);
            }
          }
        }
        if (Array.isArray(node.declaration?.declarations)) {
          for (const declaration of node.declaration.declarations) {
            if (declaration.id?.name) {
              exportNames.push(declaration.id.name);
            }
          }
        }
        break;
      }
      case "ExportDefaultDeclaration": {
        if (!node?.declaration?.name) {
          throw new Error("Default exports must be named");
        }
        defaultName = node.declaration.name;
        exportNames.push("default");
        break;
      }
      case "ExportAllDeclaration": {
        throw new Error("Export all not supported");
      }
      case "ExportSpecifier": {
        exportNames.push(node.exported.name);
        break;
      }
    }
  }

  if (!useClient && !useServer) {
    return { useClient: false, useServer: false, source };
  }
  if (useClient && useServer) {
    throw new Error(
      "Cannot both 'use client' and 'use server' in the same module"
    );
  }

  if (useClient) {
    let str = `import {CLIENT_SYMBOL} from "joe-dom";\n`;

    for (const name of exportNames) {
      const exp = `{$$typeof:CLIENT_SYMBOL,$$id:${JSON.stringify(
        `${moduleId}#${name}`
      )}}`;
      if (name === "default") {
        str += `export default ${exp};\n`;
      } else {
        str += `export const ${name} = ${exp};\n`;
      }
    }

    return {
      useClient: true,
      useServer: false,
      exportNames,
      defaultName,
      source: str,
    };
  }

  let str = (source += "\n");

  for (let name of exportNames) {
    if (name === "default") {
      name = defaultName;
    }
    str += `if (typeof ${name} === "function")`;
    str += `Object.defineProperties(${name}, {`;
    str += `$$typeof: { value: Symbol.for("joe-dom.server") },`;
    str += `$$id: { value: ${JSON.stringify(`${moduleId}#${name}`)} }`;
    str += "})";
  }
  return {
    useClient: false,
    useServer: true,
    exportNames,
    defaultName,
    source: str,
  };
}
