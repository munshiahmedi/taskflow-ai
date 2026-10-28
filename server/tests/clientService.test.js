jest.mock("../src/config/db", () => ({
  execute: jest.fn(),
}));

const pool = require("../src/config/db");
const clientService = require("../src/services/clientService");

describe("clientService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("uses parameterized list filters, including search input", async () => {
    const injectionLikeSearch = "' OR 1=1 --";
    pool.execute.mockResolvedValueOnce([[]]);

    await clientService.getClients({
      search: injectionLikeSearch,
      isActive: false,
    });

    const [query, params] = pool.execute.mock.calls[0];
    expect(query).toContain("(name LIKE ? OR email LIKE ?)");
    expect(query).toContain("is_active = ?");
    expect(query).not.toContain(injectionLikeSearch);
    expect(params).toEqual([
      `%${injectionLikeSearch}%`,
      `%${injectionLikeSearch}%`,
      0,
    ]);
  });

  test("creates a client with parameterized values and returns its row", async () => {
    pool.execute
      .mockResolvedValueOnce([{ insertId: 7 }])
      .mockResolvedValueOnce([
        [{ id: 7, name: "Acme", email: null, phone: null }],
      ]);

    const result = await clientService.createClient({
      name: "Acme",
      email: null,
      phone: null,
    });

    expect(pool.execute.mock.calls[0][0]).toContain(
      "INSERT INTO clients (name, email, phone)"
    );
    expect(pool.execute.mock.calls[0][1]).toEqual([
      "Acme",
      null,
      null,
    ]);
    expect(result).toEqual({
      id: 7,
      name: "Acme",
      email: null,
      phone: null,
    });
  });

  test("returns 404 when updating a client that does not exist", async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    await expect(
      clientService.updateClient(77, { name: "Acme" })
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(pool.execute).toHaveBeenCalledTimes(1);
  });

  test("returns 404 when changing status for a missing client", async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    await expect(
      clientService.updateClientStatus(77, false)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
