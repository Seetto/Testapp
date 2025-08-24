'use client'

import Image from "next/image";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import GoogleLoginButton from "../components/GoogleLoginButton";

export default function Home() {
  const { data: session, status } = useSession();

  useEffect(() => {
    // Redirect authenticated users to calendar
    if (session) {
      redirect('/calendar');
    }
  }, [session]);

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
        <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={180}
            height={38}
            priority
          />
          <p className="font-sans text-sm text-gray-600 dark:text-gray-400 text-center">
            Loading...
          </p>
        </main>
      </div>
    );
  }

  // Only show login page if user is not authenticated
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <GoogleLoginButton />
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <p className="font-sans text-sm text-gray-600 dark:text-gray-400 text-center">
          This is my first next js site
        </p>
      </main>
    </div>
  );
}
