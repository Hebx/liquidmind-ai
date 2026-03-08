import assert from "node:assert/strict";
import test from "node:test";

import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JSDOM } from "jsdom";

import IntentForm from "./IntentForm";

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });

  Object.defineProperties(globalThis, {
    window: {
      configurable: true,
      value: dom.window,
    },
    document: {
      configurable: true,
      value: dom.window.document,
    },
    navigator: {
      configurable: true,
      value: dom.window.navigator,
    },
    HTMLElement: {
      configurable: true,
      value: dom.window.HTMLElement,
    },
    HTMLButtonElement: {
      configurable: true,
      value: dom.window.HTMLButtonElement,
    },
    HTMLTextAreaElement: {
      configurable: true,
      value: dom.window.HTMLTextAreaElement,
    },
    Node: {
      configurable: true,
      value: dom.window.Node,
    },
    MutationObserver: {
      configurable: true,
      value: dom.window.MutationObserver,
    },
    getComputedStyle: {
      configurable: true,
      value: dom.window.getComputedStyle.bind(dom.window),
    },
    requestAnimationFrame: {
      configurable: true,
      value: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
    },
    cancelAnimationFrame: {
      configurable: true,
      value: (handle: number) => clearTimeout(handle),
    },
  });

  Object.defineProperties(dom.window.HTMLElement.prototype, {
    attachEvent: {
      configurable: true,
      value: () => {},
    },
    detachEvent: {
      configurable: true,
      value: () => {},
    },
  });

  return () => {
    cleanup();
    dom.window.close();
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

test("submits the raw intent, shows pending state, and renders prepared workflow output with warnings", async (t) => {
  const teardownDom = installDom();
  t.after(teardownDom);

  const deferredResponse = createDeferred<Response>();
  const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const previousFetch = global.fetch;

  global.fetch = (async (input, init) => {
    fetchCalls.push({ input, init });
    return deferredResponse.promise;
  }) as typeof fetch;

  t.after(() => {
    global.fetch = previousFetch;
  });

  const view = render(<IntentForm />);

  const user = userEvent.setup({
    document: globalThis.document,
  });
  const textarea = view.getByRole("textbox");
  const rawIntent = "  rebalance the Base Sepolia WETH/USDC position using medium risk settings  ";
  await user.type(
    textarea,
    rawIntent,
  );
  await user.click(view.getByRole("button", { name: /prepare http intent/i }));

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0]?.input, "/api/intent");
  assert.equal(fetchCalls[0]?.init?.method, "POST");
  assert.equal(fetchCalls[0]?.init?.headers?.["content-type"], "application/json");
  assert.equal(
    fetchCalls[0]?.init?.body,
    JSON.stringify({
      rawIntent,
    }),
  );

  assert.ok(view.getByText(/preparing workflow output/i));

  deferredResponse.resolve(
    new Response(
      JSON.stringify({
        ok: true,
        intent: {
          action: "rebalance",
          tokenA: "WETH",
          tokenB: "USDC",
          amount: "1000000",
          preferredChains: ["base-sepolia"],
          riskTolerance: "medium",
          minYield: 5,
        },
        workflow: {
          status: "prepared",
          intent: {
            action: "rebalance",
            tokenA: "WETH",
            tokenB: "USDC",
            amount: "1000000",
            preferredChains: ["base-sepolia"],
            riskTolerance: "medium",
            minYield: 5,
          },
          hookAction: {
            actionId: "0x1".padEnd(66, "0"),
            coordinator: "0x68F321d6d33b23bAFC03CC4d84b1dBbe7cBFd063",
            coordinatorCalldata: "0xdeadbeef",
            tickLower: -77220,
            tickUpper: -74820,
          },
          warnings: [
            {
              code: "FEE_ACTION_UNAVAILABLE",
              message: "Volatility analysis unavailable. Fee update action was not prepared.",
            },
          ],
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    ),
  );

  await waitFor(() => {
    assert.ok(view.getByText(/prepared workflow output/i));
  });

  assert.ok(view.getAllByText(/parsed canonical intent/i).length >= 1);
  assert.ok(
    view.getAllByText(/volatility analysis unavailable\. fee update action was not prepared\./i).length >= 1,
  );
  assert.ok(view.getByText(/no on-chain transaction is submitted from this ui/i));
  assert.ok(view.getByText(/prepared action metadata/i));
  assert.ok(view.getByText(/hook action id/i));
  assert.ok(
    view.getAllByText(/0x1000000000000000000000000000000000000000000000000000000000000000/i).length >= 1,
  );
  assert.ok(view.getByText(/^coordinator$/i));
  assert.ok(
    view.getAllByText(/0x268c2e3d23f5cddaa0d0b40142053414cc05991b/i).length >= 1,
  );
  assert.ok(view.getByText(/tick range/i));
  assert.ok(view.getByText(/-77220 → -74820/i));
  assert.ok(view.getAllByText(/"riskTolerance": "medium"/i).length >= 1);
  assert.ok(view.getByText(/"tickLower": -77220/i));
});

test("shows sanitized route failures without implying execution", async (t) => {
  const teardownDom = installDom();
  t.after(teardownDom);

  const previousFetch = global.fetch;
  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid intent: only base-sepolia is supported.",
        },
      }),
      {
        status: 422,
        headers: {
          "content-type": "application/json",
        },
      },
    )) as typeof fetch;

  t.after(() => {
    global.fetch = previousFetch;
  });

  const view = render(<IntentForm />);

  const user = userEvent.setup({
    document: globalThis.document,
  });
  await user.type(view.getByRole("textbox"), "rebalance on ethereum mainnet");
  await user.click(view.getByRole("button", { name: /prepare http intent/i }));

  await waitFor(() => {
    assert.ok(view.getByText(/preparation failed/i));
  });

  assert.ok(view.getByText(/invalid intent: only base-sepolia is supported\./i));
  assert.ok(view.getByText(/prepared workflow output only/i));
  assert.equal(view.queryByText(/submitted on-chain/i), null);
});

test("ignores stale in-flight responses after the draft is cleared and replaced", async (t) => {
  const teardownDom = installDom();
  t.after(teardownDom);

  const deferredResponse = createDeferred<Response>();
  const previousFetch = global.fetch;

  global.fetch = (async () => deferredResponse.promise) as typeof fetch;

  t.after(() => {
    global.fetch = previousFetch;
  });

  const view = render(<IntentForm />);

  const user = userEvent.setup({
    document: globalThis.document,
  });
  const textarea = view.getByRole("textbox");

  await user.type(textarea, "rebalance weth/usdc");
  await user.click(view.getByRole("button", { name: /prepare http intent/i }));

  assert.ok(view.getByText(/preparing workflow output/i));

  await user.click(view.getByRole("button", { name: /clear output/i }));
  await waitFor(() => {
    assert.ok(view.getByText(/ready to prepare/i));
  });

  await user.type(textarea, "new draft after clearing");
  assert.equal((textarea as HTMLTextAreaElement).value, "new draft after clearing");

  deferredResponse.resolve(
    new Response(
      JSON.stringify({
        ok: true,
        intent: {
          action: "rebalance",
        },
        workflow: {
          status: "prepared",
          hookAction: {
            actionId: "0x1".padEnd(66, "0"),
          },
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    ),
  );

  await waitFor(() => {
    assert.ok(view.getByDisplayValue("new draft after clearing"));
  });

  assert.ok(view.getByText(/ready to prepare/i));
  assert.equal(view.queryByText(/returned successfully/i), null);
  assert.equal(view.queryByText(/preparation failed/i), null);
});

test("shows a response parse error when the server replies with unreadable JSON", async (t) => {
  const teardownDom = installDom();
  t.after(teardownDom);

  const previousFetch = global.fetch;
  global.fetch = (async () =>
    new Response("not-json", {
      status: 502,
      headers: {
        "content-type": "application/json",
      },
    })) as typeof fetch;

  t.after(() => {
    global.fetch = previousFetch;
  });

  const view = render(<IntentForm />);

  const user = userEvent.setup({
    document: globalThis.document,
  });
  await user.type(view.getByRole("textbox"), "rebalance weth/usdc");
  await user.click(view.getByRole("button", { name: /prepare http intent/i }));

  await waitFor(() => {
    assert.ok(view.getByText(/preparation failed/i));
  });

  assert.ok(view.getByText(/response_parse_error/i));
  assert.ok(view.getByText(/intent route returned an unreadable response\./i));
  assert.equal(view.queryByText(/before the server returned a response/i), null);
});

test("shows a response shape error when the server returns valid JSON without required prepared fields", async (t) => {
  const teardownDom = installDom();
  t.after(teardownDom);

  const previousFetch = global.fetch;
  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        ok: true,
        intent: {
          action: "rebalance",
        },
        workflow: {
          status: "prepared",
          hookAction: {
            actionId: "0x1".padEnd(66, "0"),
          },
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    )) as typeof fetch;

  t.after(() => {
    global.fetch = previousFetch;
  });

  const view = render(<IntentForm />);

  const user = userEvent.setup({
    document: globalThis.document,
  });
  await user.type(view.getByRole("textbox"), "rebalance weth/usdc");
  await user.click(view.getByRole("button", { name: /prepare http intent/i }));

  await waitFor(() => {
    assert.ok(view.getByText(/preparation failed/i));
  });

  assert.ok(view.getByText(/response_shape_error/i));
  assert.ok(view.getByText(/intent route returned an unexpected response shape\./i));
  assert.equal(view.queryByText(/prepared action metadata/i), null);
});
