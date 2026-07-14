import React from "react";
import { ModelConfig } from "../types";
import { getModelIconSymbol, getModelIconVariant } from "../constants/modelIcons";

interface ModelIconProps {
  model: Pick<ModelConfig, "id" | "provider" | "label" | "model" | "customProviderId">;
  size?: number;
}

export function ModelIcon({ model, size = 16 }: ModelIconProps) {
  const symbol = getModelIconSymbol(model);
  const variant = getModelIconVariant(model);
  const fontSize = symbol.length > 1 ? size * 0.38 : size * 0.52;

  return (
    <span
      className={`model-icon-badge${variant ? ` variant-${variant}` : ""}`}
      style={{
        width: size,
        height: size,
        fontSize,
      }}
      aria-hidden="true"
    >
      {symbol}
    </span>
  );
}
