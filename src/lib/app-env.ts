// Ambiente da instalação: produção (padrão) ou testes.
// Em testes: faixa de aviso em todas as telas e exportação iCal desligada,
// para que dados de teste nunca cheguem ao Airbnb ou ao Booking.

export type AppEnv = "production" | "staging";

export function parseAppEnv(value: string | undefined): AppEnv {
  const v = (value ?? "").trim().toLowerCase();
  return ["staging", "teste", "testes", "test", "homologacao"].includes(v) ? "staging" : "production";
}

export function appEnv(): AppEnv {
  return parseAppEnv(process.env.APP_ENV);
}

export function isStaging(): boolean {
  return appEnv() === "staging";
}
