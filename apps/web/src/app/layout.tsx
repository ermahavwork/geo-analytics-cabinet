import type { Metadata } from "next";
import "@fontsource-variable/geologica";
import "@fontsource-variable/golos-text";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Геокабинет — аналитика присутствия на картах",
  description:
    "Просмотры карточек, звонки, маршруты и отзывы по всем филиалам компании.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
