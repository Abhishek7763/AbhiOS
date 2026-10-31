import { renderGoalOsPng } from '@/src/lib/png-icon';

export async function GET() {
  return renderGoalOsPng(180, false);
}
