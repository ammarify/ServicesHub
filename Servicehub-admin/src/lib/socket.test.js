import { afterEach, describe, expect, it, vi } from "vitest";

const { ioClient } = vi.hoisted(() => ({
  ioClient: vi.fn(() => ({ on: vi.fn(), connect: vi.fn() })),
}));
vi.mock("socket.io-client", () => ({ io: ioClient }));

// socket.js reads VITE_API_URL when it loads, so each case loads a fresh copy.
async function loadWithApiUrl(apiUrl) {
  vi.stubEnv("VITE_API_URL", apiUrl);
  vi.resetModules();
  return import("./socket");
}

afterEach(() => {
  vi.unstubAllEnvs();
  ioClient.mockClear();
});

describe("sockets", () => {
  it("connect to the API's own origin when it has a full URL", async () => {
    const { createStaffSocket } = await loadWithApiUrl("http://localhost:5000/api");
    createStaffSocket();

    const [url, options] = ioClient.mock.calls[0];
    expect(url).toBe("http://localhost:5000");
    expect(options).toMatchObject({ withCredentials: true });
    expect(options.transports).toBeUndefined();
  });

  it("go through this site on long-polling when the API is forwarded", async () => {
    const { createSimulatorSocket, createStaffSocket } = await loadWithApiUrl("");
    createStaffSocket();
    createSimulatorSocket();

    for (const [url, options] of ioClient.mock.calls) {
      expect(url).toBe(window.location.origin);
      expect(options.transports).toEqual(["polling"]);
    }
    expect(ioClient).toHaveBeenCalledTimes(2);
  });
});
