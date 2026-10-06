export function passwordProblem(password: string): string {
  if (!password) return "Құпиясөз бос болмауы керек.";
  if (Array.from(password).length < 8) return "Құпиясөз қабылданбайды: кемінде 8 таңба қажет.";
  if (!/\p{L}/u.test(password)) return "Құпиясөз тым оңай: әріп қосыңыз.";
  if (!/[0-9]/.test(password)) return "Құпиясөз тым оңай: сан қосыңыз.";
  if (!/[^\p{L}0-9\s]/u.test(password)) return "Құпиясөз тым оңай: арнайы таңба қосыңыз.";
  return "";
}
