import { type FunctionComponent } from "joe-dom";

import { SayHello } from "./say-hello";

export function App() {
  return (
    <html>
      <head>
        <title>joe-dom</title>
      </head>
      <body>
        <Boundary>
          <Profile />
        </Boundary>
      </body>
    </html>
  );
}

const Boundary: FunctionComponent = ({ children }) => children;
Boundary.fallback = () => <div>Loading...</div>;

const Profile: FunctionComponent = async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return <SayHello name="World!" />;
};
