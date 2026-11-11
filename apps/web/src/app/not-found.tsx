import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-3 p-6">
      <h1 className="font-display text-2xl font-semibold">
        Такой страницы нет
      </h1>
      <p className="text-muted">
        Возможно, ссылка устарела или в адресе опечатка.
      </p>
      <Link href="/" className="text-route underline underline-offset-4">
        Вернуться к обзору
      </Link>
    </main>
  );
}
