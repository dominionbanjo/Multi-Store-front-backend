import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  user: {
    id: string;
    name: string;
    role: string;
  };
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
