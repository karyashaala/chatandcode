import {
  type ConnectMcpApprovalCall,
  createConnectMcpApprovalCommand,
} from "@cctools/client-runtime/state/connectMcpApproval";
import { squashAtomCommandFailure } from "@cctools/client-runtime/state/runtime";
import type { EnvironmentId } from "@cctools/contracts";
import * as Result from "effect/Result";

import { connectionAtomRuntime } from "../connection/runtime";
import { appAtomRegistry } from "../rpc/atomRegistry";

const connectMcpApproval = createConnectMcpApprovalCommand(connectionAtomRuntime);

/** One agent sign-in call to `environmentId`, sent with this account's ChatAndCode Connect session. */
export async function runConnectMcpApproval(
  environmentId: EnvironmentId,
  call: ConnectMcpApprovalCall,
) {
  const result = await connectMcpApproval.run(appAtomRegistry, { environmentId, call });
  return result._tag === "Success"
    ? Result.succeed(result.value)
    : Result.fail(squashAtomCommandFailure(result));
}
