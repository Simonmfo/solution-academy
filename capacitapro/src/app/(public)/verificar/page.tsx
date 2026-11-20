"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SOLUTION_ACADEMY } from "@/lib/solution-academy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function VerifyCertificateSearchPage() {
  const router = useRouter();
  const [code, setCode] = React.useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = code.trim();
    if (!cleaned) return;
    router.push(`/verificar/${encodeURIComponent(cleaned)}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SOLUTION_ACADEMY.logoPath}
            alt={SOLUTION_ACADEMY.name}
            className="mx-auto mb-2 h-14 w-14 rounded-xl border border-border object-cover shadow-sm"
          />
          <CardTitle className="text-2xl font-bold">
            Validar Certificado — {SOLUTION_ACADEMY.name}
          </CardTitle>
          <CardDescription>
            Ingresá el código UUID único que aparece debajo del código QR en el diploma oficial de{" "}
            {SOLUTION_ACADEMY.name} para comprobar su autenticidad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              required
              placeholder="Ej. 550e8400-e29b-41d4-a716-446655440000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button type="submit">
              <Search className="h-4 w-4" /> Verificar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

