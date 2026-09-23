import { NewDeck } from "@/components/NewDeck";

export default function Home() {
  return <NewDeck inrRate={Number(process.env.INR_RATE ?? 95)} />;
}
