<div align="center">
  <img src="https://raw.githubusercontent.com/servall/app-config/master/img/app-config.png" width="40%" align="center" alt="app-config">
</div>
<br />

# App Config
[![Licensed under MPL 2.0](https://img.shields.io/badge/license-MPL_2.0-green.svg)](https://www.mozilla.org/en-US/MPL/2.0/)
[![Build Status](https://github.com/servall/app-config/workflows/CI/badge.svg)](https://github.com/servall/app-config/actions)
[![npm](https://img.shields.io/npm/v/@lcdev/app-config.svg)](https://www.npmjs.com/package/@lcdev/app-config)

Simple configuration loader for node. Comes with strong typing, schema validation,
many supported file formats, secrets, environment variables, and more.

Why yet-another-config-package? We want strong typing and strict validation of our
configurations, for confidence in development and production. We also want the
flexibility of using different file formats, using environment variables, and
keeping secrets safe. It should be abundantly easy and straightforward to change
configuration with confidence.

**What is it not useful for** (as of today):
- dynamic configuration (behaviour), since it only allows static configuration
- system global configuration, since it assumes configuration local to your application

Benefits:
- **Types** - All config variables have types. Environment variables alone do not store type information.
- **Validation** - Config variables are validated against a JSON schema. This ensures that configurations are valid, when the app loads instead of when you least expect it.
- **Hierarchy** - Config variables can have hierarchy and structure.
- **Code Generation** - Configuration schemas can be used to generate correct types in your language of choosing (typescript, swift, rust, and many more), all automatically.
- **Configuration Formats** - Everyone has their own preferences for configuration format - supports JSON, JSON5, TOML, YAML out of the box.
- **Lists** - Config can include lists of variables. This can be useful when a dynamic number of settings is required, and can be difficult to do with plain environment variables.

### Alternatives
- [node-config-ts](https://www.npmjs.com/package/node-config-ts)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [rc](https://www.npmjs.com/package/rc)
- [nconf](https://www.npmjs.com/package/nconf)
- [config](https://www.npmjs.com/package/config)
- [node-convict](https://www.npmjs.com/package/convict)

### Core Functionality
- Loads your configuration from environment variable or a file (YAML, TOML, JSON, JSON5)
- Validates your configuration using JSON Schema
- Generates strong types from your schema (using [quicktype](https://quicktype.io/))
- Includes a CLI tool for injecting configuration as a environment variables
- Global configuration extension, allowing CI specific configuration without overriding config
- Explicit secret config items, disallowed in non-secret configuration

# Getting Started
Add the module to your project, using your preferred NPM client. Then run the init command.

```
yarn add @lcdev/app-config

npx app-config init
```

The CLI init command simply creates `.app-config.*` files.  You can then run
`npx app-config variables` at any time to see your populated configuration.

You might start with a simple configuration, like:

.app-config.yml
```yaml
webServer:
  port: 3000

database:
  host: "localhost"
  port: 5432
  name: "master"
```

.app-config.schema.yml
```yaml
type: object
required:
  - webServer
  - database
properties:
  webServer:
    type: object
    required: [port]
    properties:
      port:
        type: number
  database:
    type: object
    required: [host, port, name]
    properties:
      host:
        type: string
      port:
        type: number
      name:
        type: string
```

Check out the [JSON Schema](https://json-schema.org/) documentation for details.

### Files and Formats
This module supports YAML, TOML, JSON, and JSON5 out of the box, for any of the files. Your
schema could be YAML, and config be TOML, or any other way around. By default the CLI produces YAML for all files.

- Configuration files are `.app-config.{ext}` or `app-config.{ext}`
- Secret configuration items
- Schema files are `.app-config.schema.{ext}` or `app-config.schema.{ext}`
- Meta files are `.app-config.meta.{ext}` or `app-config.meta.{ext}`
- Meta properties are specified in the root of any file (except meta files) under the `app-config` key
- The `APP_CONFIG` environment variable always takes precedent over files, and can be in any supported format
- The `APP_CONFIG_CI` or `APP_CONFIG_EXTEND` environment variable is parsed and deeply merged with your main configuration, if loading from a file

### CLI
This module comes with a CLI tool for common usage. Running `npx app-config --help`
will give you a list of commands and options.

Common options are:

```
app-config -- {cmd-that-consumes-env-variables}

# for example:
app-config -- docker-compose up -d

# spits out all config to stdout
app-config vars

# spits out all config as a different format
app-config create --format json

# runs code-generation from your schema types
app-config generate
```

Of course, you can and should use `app-config` in your `package.json` scripts.
Note that running commands this way (`--`) also get a `APP_CONFIG` variable (in YAML by default).

### Schemas
This module uses JSON Schema to define constraints on your configuration. As shown above,
the schema is loaded from the `.app-config.schema.{ext}` file. This cannot be specified
by an environment variable, so be certain that it is included in your production environment.

Schemas have support for loading `$ref` properties, to reduce duplication of properties.
That means that if you define a type as `$ref: '../another-file.yml#/definitions/CommonItem'`
that resolution will be completed automatically.

### Secrets
Secrets are defined in your schema.

```yml
super-secret-property:
  type: string
  format: uri
  secret: true
```

Inserting that non-standard key will automatically prevent you from putting that property
in your main `.app-config.{ext}` file, requiring you to put it in `.app-config.secrets.{ext}`.
You should gitignore the secrets file to prevent ever accidentally adding secrets to VCS.

### Code Generation (typescript & others)
This module supports automatic type generation thanks to [quicktype](https://quicktype.io/).
You write the schema, and a typed representation can be generated for you so that your
code is correct.

In your meta file, you can define:

```yml
generate:
  - { type: 'ts', file: 'src/config.d.ts' }
```

You can also do so in a top-level property of your config or schema file.

After this, you can simply run `app-config gen`. This will write the file(s) you specified in
meta configuration. It's recommended to add a call to this in your `dev` script, so that your
code is always in sync with your schema.

Right now, we only officially support typescript, but quicktype is extensible to other languages.
You might have luck simply generating a different file type.

More options are available for generation:

- `type: string` changes the file type, which is inferred by the filename
- `name: string` changes the default config interface's name
- `augmentModule: boolean` turns on or off the automatic module augmentation of app-config's default export
- `leadingComments: string[]` changes the top-of-file comment block that's generated
- `rendererOptions: { [key: string]: string }` adds any quicktype supported renderer option (like `just-types`)

### Config Generation
We use the same infrastructure as described above for "config generation". That means that when running
generation, you can just specify an output file like `my-other-config.yaml`. And instead of static types
like above, the full configuration is spit out into that file.

This is extensible (and mostly only useful for) "selection", like in the creation CLI.

```
generate:
  - { file: 'rustw.toml', select: '#/build/cargo-src' }
```

There is also the `includeSecrets` boolean option, which is disabled by default.

### Extends
This module supports a special 'extending' syntax for deduplicating configuration.

In your main config:

```yaml
app-config:
  extends:
    - other-file.yml
```

This will do a deep merge of `other-file.yml` into your main configuration.

### Environment Specific Config
This module supports environment specific config and will attempt to load the config based on your
`NODE_ENV|ENV|APP_CONFIG_ENV` environment variable and fallback to the default config file if
nothing matching is found.

Environment specific configuration files are named `[.]app-config.{NODE_ENV|ENV|APP_CONFIG_ENV}.{ext}`.

If you prefer, you can alias the development and production config filenames with the short naming convention: `[.]app-config.dev.{ext}` and `[.]app-config.prod.{ext}`.

Secret files follow the same pattern and are loaded based on your `NODE_ENV|ENV|APP_CONFIG_ENV`.

You can also use a special `$env` property within any objects. This also supports aliasing.

```yaml
my-server-config:
  logging: false
  $env:
    default:
      port: 3000
    dev:
      port: 8080
    production:
      port: 80
```

The config above would result in:
 - default: `{ my-server-config: { logging: false, port: 3000 } }`
 - development: `{ my-service-config: { logging: false, port: 8080 } }`
 - production: `{ my-server-config: { logging: false, port: 80 } }`

#### Extends Combined with Environment Specific Config
Using $env alongside extends, you can load different files for each environment.

```yaml
app-config:
  extends:
    $env:
      development:
        - 'test-database-config.yml'
        - 'database-config.yml'
      production:
        - 'database-config.yml'
```

This way, only 'database-config.yml' will be included in 'production' config; Where as 
'test-databases-config.yml' and 'database-config.yml' will be included in 'development' config.

### Using External Variables
If you need to, you can access environment variables with the string syntax `$VAR_NAME` or `${VAR_NAME}`.
This will in-place change the value to that environment variable.

You can also use the bash fallback syntax, like `${VAR:-fallback value}` or `${VAR:-${OTHER_VAR}}`.

### Node API
This module exports a basic stable node API to do what you would expect.

```typescript
// this is an already validated config object
export default config;

export {
  // loads app config from the filesystem
  loadConfig(cwd?, { fileNameOverride?, envOverride? }?),
  loadConfigSync(cwd?, { fileNameOverride?, envOverride? }?),
  // loads app config schema from the filesystem
  loadSchema(cwd?),
  loadSchemaSync(cwd?),
  // validates the config against a schema
  validate(LoadedConfig & { schema }, cwd?),
  // loads app config and validates the schema
  loadValidated(cwd?),
  loadValidatedSync(cwd?),
  // creates generated files defined in the schema
  generateTypeFiles(cwd?),
} from './schema';
```

Alternatively, if you don't want the config to be loaded on import, you'll need to:

```typescript
import { loadValidated } from '@lcdev/app-config/dist/exports';

loadValidated(cwd?).then(...);
```

### Roadmap
- [x] Webpack loader
- [ ] Child `extends` properties
- [ ] Non-js language support
