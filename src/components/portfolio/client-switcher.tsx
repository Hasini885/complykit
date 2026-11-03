"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, LayoutGrid, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { initials, typeLabel } from "@/lib/portfolio/clients";
import { cn } from "@/lib/utils";

export function ClientSwitcher() {
  const { ready, clients, activeClient, setActiveClient } = usePortfolio();

  if (!ready) {
    return <div className="h-9 w-56 animate-pulse rounded-md bg-muted" aria-hidden />;
  }

  if (clients.length === 0) {
    return (
      <Button asChild variant="outline" size="sm" className="gap-2">
        <Link href="/portfolio">
          <Plus className="size-4" aria-hidden />
          Add your first client
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            activeClient
              ? `Active client: ${activeClient.name}. Switch client`
              : "Showing all companies. Choose a client"
          }
          className="flex h-10 max-w-[16rem] items-center gap-2 rounded-full border bg-card/80 pr-3 pl-1.5 text-left shadow-card backdrop-blur transition-colors hover:border-primary/40"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-500 font-mono text-[10px] font-bold text-white">
            {activeClient ? initials(activeClient.name) : <LayoutGrid className="size-3.5" aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium leading-tight">
              {activeClient?.name ?? "All companies"}
            </span>
            <span className="block truncate text-[10px] leading-tight text-muted-foreground">
              {activeClient
                ? `${typeLabel(activeClient.type)} · ${activeClient.cin}`
                : `Admin view · ${clients.length} compan${clients.length === 1 ? "y" : "ies"}`}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Clients</span>
          <span className="tabular font-mono text-[10px] font-normal text-muted-foreground">
            {clients.length}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => void setActiveClient(null)} className="gap-2.5 py-2">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded",
              activeClient ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
            )}
          >
            <LayoutGrid className="size-3.5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium">All companies</span>
            <span className="block text-[10px] text-muted-foreground">Admin view</span>
          </span>
          {activeClient ? null : <Check className="size-3.5 text-primary" aria-hidden />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <div className="max-h-80 overflow-y-auto">
          {clients.map((client) => {
            const isActive = client.id === activeClient?.id;
            return (
              <DropdownMenuItem
                key={client.id}
                onSelect={() => void setActiveClient(client.id)}
                className="gap-2.5 py-2"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {initials(client.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{client.name}</span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">
                    {client.cin}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <Badge variant="outline" className="text-[9px]">
                    {typeLabel(client.type)}
                  </Badge>
                  {isActive ? <Check className="size-3.5 text-primary" aria-hidden /> : null}
                </span>
              </DropdownMenuItem>
            );
          })}
        </div>

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
