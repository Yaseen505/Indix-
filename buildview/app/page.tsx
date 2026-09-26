import {getChatGPTUser} from './chatgpt-auth';
import Portal from './portal';
export const dynamic='force-dynamic';
export default async function Page(){const me=await getChatGPTUser();return <Portal signedIn={!!me} />}
