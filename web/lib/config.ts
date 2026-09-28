/**
 * The deployment this app reads and writes. The default is the deployment of
 * record, whose bytes were verified against contracts/occurra.py; an
 * environment override points a checkout at another deployment, and the app
 * says so on every page it renders.
 */
export const RECORD_ADDRESS = "0xceCD0B81fBd1BF4e969C908D1452B26D17066E22";

/**
 * The exits and the long appeal paths ran on a second deployment of the same
 * bytes, so a network stall in that run could never block the deployment the
 * app writes to.
 */
export const PATHS_ADDRESS = "0x5065765380a0851C26fC30203246A58d25B9e1E5";

const override = process.env.NEXT_PUBLIC_OCCURRA_CONTRACT?.trim() ?? "";

export const CONTRACT_ADDRESS = (override || RECORD_ADDRESS) as `0x${string}`;
export const CONTRACT_CONFIGURED = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS) && !/^0x0{40}$/.test(CONTRACT_ADDRESS);
export const IS_RECORD = CONTRACT_ADDRESS.toLowerCase() === RECORD_ADDRESS.toLowerCase();

/** The sha256 of the contract source these bytes were compiled from. */
export const SOURCE_SHA256 =
  "73632543ef19a41d729c8f1dcef6a4dc8ca766f26e54f714fdd60d53b1c17792";

export const REPO_URL = "https://github.com/Hemmy1417/Occurra";
export const SOURCE_URL = `${REPO_URL}/blob/main/contracts/occurra.py`;
