const flagConfiguration = {
  "show-done-todos": {
    variants: { on: true, off: false },
    defaultVariant: "on",
    disabled: false,
  },
} as const;

export { flagConfiguration };
