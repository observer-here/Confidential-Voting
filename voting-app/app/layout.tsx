import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AppKitProvider } from "@/contexts/appkit"
import { Web3Provider } from "@/contexts/web3-context"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Confidential Voting DApp",
  description: "Privacy-preserving voting application using Fhenix CoFHE",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppKitProvider>
          <Web3Provider>
            {children}
            <Toaster />
          </Web3Provider>
        </AppKitProvider>
      </body>
    </html>
  )
}
