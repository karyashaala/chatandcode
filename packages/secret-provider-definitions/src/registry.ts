import { makeSecretProviderDefinitionRegistry } from "@cctools/secret-provider-core/shared/definition";
import * as OnePassword from "@cctools/secret-provider-onepassword/shared/definition";

export const builtInSecretProviderDefinitions = makeSecretProviderDefinitionRegistry([
  OnePassword.definition,
]);
