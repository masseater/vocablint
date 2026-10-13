import { createDecisionPlugin, defineDecisionRule } from "@r_masseater/oxlint-plugin-decision";

export default createDecisionPlugin({
  name: "stack",
  rules: [
    defineDecisionRule({
      id: "exclusive-status",
      target: "file",
      question:
        "Does this code represent one piece of state with several boolean flags or optional fields whose combinations can contradict each other, instead of one exclusive status expressed as a discriminated union? Answer no when every state is a single exclusive status, or when the file holds no such state.",
      message: "状態は排他的なstatusを持つ判別共用体で表し、booleanフラグの組を使わない。",
      cutoff: 0.8,
    }),
    defineDecisionRule({
      id: "server-state-tanstack-query",
      target: "file",
      question:
        "Does this code fetch, cache or synchronize server data on the client with something other than TanStack Query, such as fetch inside useEffect, SWR or a hand-written cache? Answer no when server data on the client goes only through TanStack Query, or when the file handles none. Creating an API client such as a better-auth or Eden client, which fetches nothing until a query calls it, is not a violation.",
      message: "サーバー状態はTanStack Queryだけで扱う。",
      cutoff: 0.8,
    }),
    defineDecisionRule({
      id: "ui-state-effect-atom",
      target: "file",
      question:
        "Does this code hold client-side UI state with something other than effect-atom, such as useState, useReducer, React context used as a store, zustand, jotai or redux? Answer no when client-side UI state is held only by effect-atom, or when the file holds none. Creating a TanStack Query QueryClient or configuring the router, which hold no UI state, is not a violation.",
      message: "UI状態はeffect-atomだけで扱う。",
      cutoff: 0.8,
    }),
  ],
});
