import { describe, it, expect, vi } from "vitest";
import { starterQuestions } from "../src/content/starter";
import { questionSchema } from "../src/features/questions/model";
import { gameCatalog, newQuestion } from "../src/features/games/catalog";
import { filterQuestions } from "../src/features/questions/filter";
import { randomId, randomToken } from "../src/shared/client/random";
import { roomCodeFromQr } from "../src/features/play/room-code";
import { lanAddress } from "../src/server/network";
import { cleanHints, hintSlots } from "../src/features/games/hints";
describe("question library", () => {
  it("rejects duplicate quiz options after trimming, case and spacing normalization", () => {
    const q = {
      ...newQuestion("choice"),
      title: "Duplicate options",
      options: ["Ha Noi", " ha  noi "],
      correct: 0,
    };
    expect(questionSchema.safeParse(q).success).toBe(false);
  });
  it("starts with three hint slots and validates text/image hints while keeping legacy text", () => {
    for (const kind of Object.keys(gameCatalog))
      expect(
        hintSlots(newQuestion(kind as keyof typeof gameCatalog).hints),
      ).toHaveLength(3);
    const hints = cleanHints([
      "  Old hint  ",
      { type: "text", text: "  New hint  " },
      { type: "image", image: "/starter/farm-before.svg" },
      { type: "image", image: "" },
      "",
    ]);
    const q = {
      ...newQuestion("riddle"),
      title: "Mixed hints",
      solution: "Answer",
      hints,
    };
    expect(questionSchema.safeParse(q).success).toBe(true);
    expect(hints).toEqual([
      "Old hint",
      { type: "text", text: "New hint" },
      { type: "image", image: "/starter/farm-before.svg" },
    ]);
    expect(
      questionSchema.safeParse({
        ...q,
        hints: [{ type: "image", image: "javascript:alert(1)" }],
      }).success,
    ).toBe(false);
  });
  it("uses a physical network for QR instead of VMware/WSL adapters", () => {
    expect(
      lanAddress({
        "VMware Network Adapter VMnet1": [
          { address: "192.168.178.1", family: "IPv4", internal: false },
        ],
        "Wi-Fi 12": [
          { address: "10.149.31.41", family: "IPv4", internal: false },
        ],
        "vEthernet (WSL)": [
          { address: "172.26.0.1", family: "IPv4", internal: false },
        ],
      }),
    ).toBe("10.149.31.41");
  });
  it("ships 23 valid, unique scenarios, covering every game and difficulty", () => {
    expect(starterQuestions).toHaveLength(23);
    expect(new Set(starterQuestions.map((q) => q.id)).size).toBe(23);
    for (const q of starterQuestions)
      expect(questionSchema.safeParse(q).success, q.title).toBe(true);
    for (const kind of Object.keys(gameCatalog)) {
      for (const difficulty of ["easy", "medium", "hard"])
        expect(
          starterQuestions.some(
            (q) => q.kind === kind && q.difficulty === difficulty,
          ),
          `${kind}/${difficulty}`,
        ).toBe(true);
      expect(newQuestion(kind as keyof typeof gameCatalog).kind).toBe(kind);
    }
  });
  it("combines game, difficulty and text filters", () => {
    const found = filterQuestions(starterQuestions, {
      kind: "change",
      difficulty: "hard",
      query: "cảng",
    });
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe("7b0c6f11-5dd8-4d44-8ba7-b03a2bea1209");
  });
  it("creates strong tokens and valid UUIDs when randomUUID is unavailable on a LAN", () => {
    const spy = vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      throw Error("unavailable");
    });
    try {
      expect(randomToken()).toMatch(/^[a-f0-9]{64}$/);
      expect(randomToken()).not.toBe(randomToken());
      expect(randomId()).toMatch(
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
      );
    } finally {
      spy.mockRestore();
    }
  });
  it("extracts only a room code from QR content without navigating arbitrary scanned links", () => {
    expect(roomCodeFromQr("http://192.168.1.2:3100/?code=a1b2c3")).toBe(
      "A1B2C3",
    );
    expect(roomCodeFromQr("ABC123")).toBe("ABC123");
    expect(roomCodeFromQr("javascript:alert(1)")).toBeNull();
    expect(roomCodeFromQr("https://example.com/?code=invalid-code")).toBeNull();
  });
});
