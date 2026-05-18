/**
 * Generates only the TypeScript client from the Codama IDL.
 * Used by the Vercel build pipeline (no Rust toolchain required).
 */

import type { AnchorIdl } from '@codama/nodes-from-anchor';
import { renderVisitor as renderJavaScriptVisitor } from '@codama/renderers-js';
import fs from 'fs';
import path from 'path';

import { createEscrowCodamaBuilder } from './lib/escrow-codama-builder';
import { preserveConfigFiles } from './lib/utils';

const projectRoot = path.join(__dirname, '..');
const idlDir = path.join(projectRoot, 'idl');
const escrowIdl = JSON.parse(fs.readFileSync(path.join(idlDir, 'escrow_program.json'), 'utf-8')) as AnchorIdl;
const typescriptClientsDir = path.join(__dirname, '..', 'clients', 'typescript');

const escrowCodama = createEscrowCodamaBuilder(escrowIdl).appendAccountVersion().build();

const configPreserver = preserveConfigFiles(typescriptClientsDir);

void escrowCodama.accept(
    renderJavaScriptVisitor(typescriptClientsDir, {
        deleteFolderBeforeRendering: true,
        formatCode: true,
    }),
);

configPreserver.restore();
