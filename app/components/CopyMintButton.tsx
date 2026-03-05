"use client";

import { useState } from "react";

type Props = {
  value: string;
};

export default function CopyMintButton({ value }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className="copy-btn" onClick={onCopy} aria-label="Copy contract address">
      {copied ? "Copied" : "Copy CA"}
    </button>
  );
}
