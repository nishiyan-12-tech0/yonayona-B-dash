import { redirect } from 'next/navigation';

/** トップは戦略マップを開く */
export default function Home() {
  redirect('/map');
}
