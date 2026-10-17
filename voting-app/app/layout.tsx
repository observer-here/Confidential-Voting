import type React from "react"
import type { Metadata } from "next"
import { Inter, Instrument_Serif } from "next/font/google"
import "./globals.css"
import { AppKitProvider } from "@/contexts/appkit"
import { Web3Provider } from "@/contexts/web3-context"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif" })

export const metadata: Metadata = {
  title: "Confidential Voting",
  description: "Privacy-preserving voting with Fhenix CoFHE",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${serif.variable} font-sans`}>
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
