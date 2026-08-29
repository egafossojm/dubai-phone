/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingState } from "@/components/shared/loading-state";

describe("LoadingState", () => {
  it("affiche le message de chargement", () => {
    render(<LoadingState message="Chargement en cours…" />);
    expect(screen.getByText("Chargement en cours…")).toBeInTheDocument();
  });
});
