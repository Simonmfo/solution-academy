"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CertificateCardActions({
  verificationCode,
}: {
  verificationCode: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const url = `${window.location.origin}/verificar/${verificationCode}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex w-full flex-wrap gap-2">
      <a href={`/api/certificates/${verificationCode}/pdf`} className="flex-1">
        <Button className="w-full" size="sm">
          <Download className="h-4 w-4" /> Descargar PDF
        </Button>
      </a>
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copiado" : "Copiar Link"}
      </Button>
      <Link href={`/verificar/${verificationCode}`} target="_blank">
        <Button variant="secondary" size="sm">
          <ExternalLink className="h-4 w-4" /> Validar QR
        </Button>
      </Link>
    </div>
  );
}

