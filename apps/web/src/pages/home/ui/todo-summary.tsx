import type { ReactNode } from "react";

const TodoSummary = ({ open, done }: Readonly<{ open: number; done: number }>): ReactNode => (
  <p className="text-muted-foreground text-sm">{`${open} open / ${done} done`}</p>
);

export { TodoSummary };
