import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { login } from "./actions";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <h1 className="mb-4 text-xl font-semibold">PMS Temporada</h1>
        <ActionForm action={login} className="space-y-3">
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          <SubmitButton className="btn-primary w-full" pendingText="Entrando…">Entrar</SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}
