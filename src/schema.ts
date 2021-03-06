import * as Ajv from 'ajv';
import * as _ from 'lodash';
import { join, dirname, resolve } from 'path';
import {
  ConfigObject,
  ConfigSubObject,
  ConfigSource,
  LoadedConfig,
  loadConfig,
  loadConfigSync,
} from './config';
import { findParseableFile, findParseableFileSync, parseFileSync } from './file-loader';

const schemaFileNames = ['.app-config.schema', 'app-config.schema'];

export enum InvalidConfig {
  InvalidSchema,
  SecretInNonSecrets,
  SchemaValidation,
}

export type SchemaRefs = ConfigObject;
export type Schema = {
  schema: ConfigObject;
  schemaRefs?: SchemaRefs;
};

export const loadSchema = async (cwd = process.cwd()): Promise<Schema> => {
  const found = await findParseableFile(schemaFileNames.map(f => join(cwd, f)));

  if (!found) {
    throw new Error('Could not find app config schema.');
  }

  const schema = found[2];
  const schemaRefs = extractExternalSchemas(schema, cwd);

  return { schema, schemaRefs };
};

export const loadSchemaSync = (cwd = process.cwd()): Schema => {
  const found = findParseableFileSync(schemaFileNames.map(f => join(cwd, f)));

  if (!found) {
    throw new Error('Could not find app config schema.');
  }

  const schema = found[2];
  const schemaRefs = extractExternalSchemas(schema, cwd);

  return { schema, schemaRefs };
};

export const validate = (
  input: Schema & LoadedConfig,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  cwd = process.cwd(),
): [InvalidConfig, Error] | false => {
  const { source, config, nonSecrets, schema, schemaRefs = {} } = input;

  const ajv = new Ajv({
    allErrors: true,
  });

  Object.entries(schemaRefs).forEach(([id, schema]) => ajv.addSchema(schema as object, id));

  // array of property paths that should only be present in secrets file
  const schemaSecrets: string[] = [];

  ajv.addKeyword('secret', {
    validate(schema: any, data: any, parentSchema?: object, dataPath?: string) {
      if (!dataPath) {
        return false;
      }

      const [_, ...key] = dataPath.split('.');
      schemaSecrets.push(key.join('.'));

      return schema === true;
    },
  });

  if (typeof schema !== 'object') {
    return [InvalidConfig.InvalidSchema, new Error('schema was not an object')];
  }

  if (!schema.$schema) {
    // default to draft 07
    schema.$schema = 'http://json-schema.org/draft-07/schema#';
  }

  const validate = ajv.compile(schema);
  const valid = validate(config);

  if (source === ConfigSource.File && nonSecrets) {
    // check that the nonSecrets does not contain any properties marked as secret
    const secretsInNonSecrets = schemaSecrets.filter(secret => {
      if (_.get(nonSecrets, secret)) {
        return secret;
      }

      return false;
    });

    if (secretsInNonSecrets.length > 0) {
      return [
        InvalidConfig.SecretInNonSecrets,
        new Error(
          `Found ${secretsInNonSecrets.map(s => `'.${s}'`).join(', ')} in non secrets file`,
        ),
      ];
    }
  }

  if (!valid) {
    const err = new Error(
      `Config is invalid: ${ajv.errorsText(validate.errors, { dataVar: 'config' })}`,
    );

    err.stack = undefined;

    return [InvalidConfig.SchemaValidation, err];
  }

  return false;
};

export const loadValidated = async (cwd = process.cwd()) => {
  const loaded = await loadConfig(cwd);
  const schema = await loadSchema(cwd);

  const validation = validate({ ...schema, ...loaded }, cwd);

  if (validation) {
    throw validation[1];
  }

  return loaded;
};

export const loadValidatedSync = (cwd = process.cwd()) => {
  const loaded = loadConfigSync(cwd);
  const schema = loadSchemaSync(cwd);

  const validation = validate({ ...schema, ...loaded }, cwd);

  if (validation) {
    throw validation[1];
  }

  return loaded;
};

const extractExternalSchemas = (schema: ConfigSubObject, cwd: string, schemas: SchemaRefs = {}) => {
  if (schema && typeof schema === 'object') {
    Object.entries(schema).forEach(([key, val]) => {
      if (key === '$ref' && typeof val === 'string') {
        // parse out "filename.json" from "filename.json#/Defs/ServerConfig"
        const [, , filepath, ref] = /^(\.\/)?([^#]*)(#?.*)/.exec(val)!;

        if (filepath) {
          // we resolve filepaths so that ajv resolves them correctly
          const resolvePath = resolve(join(cwd, filepath));
          const resolvePathEncoded = encodeURI(resolvePath);
          const child = parseFileSync(resolvePath)[2];

          extractExternalSchemas(child, dirname(join(cwd, filepath)), schemas);

          if (!Array.isArray(schema)) {
            // replace the $ref inline with the resolvePath
            schema.$ref = `${resolvePathEncoded}${ref}`;
          }

          schemas[resolvePathEncoded] = child;
        }
      } else {
        extractExternalSchemas(val, cwd, schemas);
      }
    });
  }

  return schemas;
};
