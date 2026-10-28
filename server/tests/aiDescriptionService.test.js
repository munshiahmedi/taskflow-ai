const {
  generateTaskDescription,
} = require("../src/services/aiDescriptionService");

describe("AI description service", () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  const originalFetch = global.fetch;
  let consoleError;
  let consoleInfo;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    delete process.env.GEMINI_MODEL;
    global.fetch = jest.fn();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleInfo = jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    consoleInfo.mockRestore();

    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }

    if (originalModel === undefined) {
      delete process.env.GEMINI_MODEL;
    } else {
      process.env.GEMINI_MODEL = originalModel;
    }

    global.fetch = originalFetch;
  });

  test("calls the configured Gemini model and returns generated text", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "Task description and acceptance criteria" }],
            },
          },
        ],
      }),
    });

    const description = await generateTaskDescription({
      title: "Prepare monthly report",
      context: "Include a review step",
    });

    expect(description).toBe("Task description and acceptance criteria");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"
    );
    expect(options.headers["x-goog-api-key"]).toBe("test-gemini-key");
    expect(options.signal).toBeInstanceOf(AbortSignal);

    const prompt = JSON.parse(options.body).contents[0].parts[0].text;
    expect(prompt).toContain("senior product and UX designer");
    expect(prompt).toContain("accessibility, responsive layouts");
    expect(prompt).toContain(JSON.stringify("Prepare monthly report"));
    expect(prompt).toContain(JSON.stringify("Include a review step"));
  });

  test("uses GEMINI_MODEL when configured", async () => {
    process.env.GEMINI_MODEL = "gemini-configured-model";
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: "Generated description" }] } },
        ],
      }),
    });

    await generateTaskDescription({ title: "Prepare report" });

    expect(global.fetch.mock.calls[0][0]).toContain(
      "/models/gemini-configured-model:generateContent"
    );
  });

  test("fails safely when the API key is not configured", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(
      generateTaskDescription({ title: "Prepare report" })
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("maps provider rate limits to HTTP 429", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 429 });

    await expect(
      generateTaskDescription({ title: "Prepare report" })
    ).rejects.toMatchObject({
      statusCode: 429,
      category: "quota_rate_limit",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Gemini API request failed",
      { upstreamStatus: 429, category: "quota_rate_limit" }
    );
  });

  test.each([
    [401, "authentication", 502],
    [403, "authentication", 502],
    [404, "model_not_found", 502],
    [400, "request_rejected", 502],
    [500, "provider_failure", 502],
  ])(
    "logs sanitized diagnostics and safely maps upstream HTTP %i",
    async (upstreamStatus, category, statusCode) => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: upstreamStatus,
        text: async () => "sensitive provider response body",
      });

      await expect(
        generateTaskDescription({
          title: "Sensitive task title that must not be logged",
        })
      ).rejects.toMatchObject({ statusCode, category });

      expect(consoleError).toHaveBeenCalledWith("Gemini API request failed", {
        upstreamStatus,
        category,
      });
      const loggedDetails = JSON.stringify(consoleError.mock.calls);
      expect(loggedDetails).not.toContain("test-gemini-key");
      expect(loggedDetails).not.toContain(
        "Sensitive task title that must not be logged"
      );
      expect(loggedDetails).not.toContain("sensitive provider response body");
      expect(global.fetch).toHaveBeenCalledTimes(1);
    }
  );

  test("retries one HTTP 503 after one second and returns the retry result", async () => {
    const setTimeoutSpy = jest
      .spyOn(global, "setTimeout")
      .mockImplementation((callback) => {
        callback();
        return 0;
      });
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: "Generated after retry" }] } },
          ],
        }),
      });

    try {
      await expect(
        generateTaskDescription({ title: "Prepare report" })
      ).resolves.toBe("Generated after retry");

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        1000
      );
      expect(consoleError).toHaveBeenCalledWith("Gemini API request failed", {
        upstreamStatus: 503,
        category: "transient_provider_failure",
      });
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  test("returns the safe provider error after two HTTP 503 responses", async () => {
    const setTimeoutSpy = jest
      .spyOn(global, "setTimeout")
      .mockImplementation((callback) => {
        callback();
        return 0;
      });
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "sensitive provider response",
      });

    try {
      await expect(
        generateTaskDescription({
          title: "Sensitive task title that must not be logged",
        })
      ).rejects.toMatchObject({
        statusCode: 502,
        category: "provider_failure",
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(consoleError).toHaveBeenNthCalledWith(
        1,
        "Gemini API request failed",
        { upstreamStatus: 503, category: "transient_provider_failure" }
      );
      expect(consoleError).toHaveBeenNthCalledWith(
        2,
        "Gemini API request failed",
        { upstreamStatus: 503, category: "provider_failure" }
      );
      const loggedDetails = JSON.stringify(consoleError.mock.calls);
      expect(loggedDetails).not.toContain("test-gemini-key");
      expect(loggedDetails).not.toContain(
        "Sensitive task title that must not be logged"
      );
      expect(loggedDetails).not.toContain("sensitive provider response");
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  test("does not expose provider diagnostics for failed responses", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "sensitive provider diagnostics",
    });

    await expect(
      generateTaskDescription({ title: "Prepare report" })
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  test("rejects invalid provider response shapes", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [] }),
    });

    await expect(
      generateTaskDescription({ title: "Prepare report" })
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  test("maps an outbound request timeout to HTTP 504", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("timed out", "TimeoutError"));
    const timeoutSpy = jest
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(controller.signal);
    global.fetch.mockImplementationOnce(async (_url, options) => {
      expect(options.signal.aborted).toBe(true);
      throw options.signal.reason;
    });

    try {
      await expect(
        generateTaskDescription({ title: "Prepare report" })
      ).rejects.toMatchObject({
        statusCode: 504,
        category: "request_timeout",
      });
      expect(consoleError).toHaveBeenCalledWith(
        "Gemini API request timed out",
        {
          phase: "request",
          upstreamStatus: null,
          category: "request_timeout",
          abortSignalTriggered: true,
          attempt: 1,
        }
      );
      expect(consoleInfo).not.toHaveBeenCalledWith(
        "Gemini API response received",
        expect.anything()
      );
      expect(
        JSON.stringify([...consoleError.mock.calls, ...consoleInfo.mock.calls])
      ).not.toContain("test-gemini-key");
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  test("distinguishes a timeout while reading the response body", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("timed out", "TimeoutError"));
    const timeoutSpy = jest
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(controller.signal);
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw controller.signal.reason;
      },
    });

    try {
      await expect(
        generateTaskDescription({ title: "Prepare report" })
      ).rejects.toMatchObject({
        statusCode: 504,
        category: "response_body_timeout",
      });
      expect(consoleInfo).toHaveBeenCalledWith(
        "Gemini API response received",
        { attempt: 1, upstreamStatus: 200 }
      );
      expect(consoleError).toHaveBeenCalledWith(
        "Gemini API response body timed out",
        {
          phase: "response_body",
          upstreamStatus: 200,
          category: "response_body_timeout",
          abortSignalTriggered: true,
          attempt: 1,
        }
      );
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});
