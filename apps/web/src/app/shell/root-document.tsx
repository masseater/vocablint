import { RegistryProvider } from "@effect/atom-react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";

const devtoolsPlugins = [
  { name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> },
  { name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
];

const RootDocument = ({ children }: Readonly<{ children: ReactNode }>): ReactNode => (
  <html lang="en">
    <head>
      <HeadContent />
    </head>
    <body>
      <RegistryProvider>{children}</RegistryProvider>
      <TanStackDevtools plugins={devtoolsPlugins} />
      <Scripts />
    </body>
  </html>
);

export { RootDocument };
