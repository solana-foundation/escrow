/**
 * Generates TypeScript and Rust clients from the Codama IDL.
 */

import type { AnchorIdl } from '@codama/nodes-from-anchor';
import { renderVisitor as renderJavaScriptVisitor } from '@codama/renderers-js';
import { renderVisitor as renderRustVisitor } from '@codama/renderers-rust';
import fs from 'fs';
import path from 'path';

import { createEscrowCodamaBuilder } from './lib/escrow-codama-builder';
import { preserveConfigFiles } from './lib/utils';

const projectRoot = path.join(__dirname, '..');
const idlDir = path.join(projectRoot, 'idl');
const escrowIdl = JSON.parse(fs.readFileSync(path.join(idlDir, 'escrow_program.json'), 'utf-8')) as AnchorIdl;
const rustClientsDir = path.join(__dirname, '..', 'clients', 'rust');
const typescriptClientsDir = path.join(__dirname, '..', 'clients', 'typescript');

const escrowCodama = createEscrowCodamaBuilder(escrowIdl).appendAccountVersion().build();

const configPreserver = preserveConfigFiles(typescriptClientsDir, rustClientsDir);

// Generate Rust client
void escrowCodama.accept(
    renderRustVisitor(rustClientsDir, {
        deleteFolderBeforeRendering: true,
        formatCode: false,
    }),
);

// Generate TypeScript client
void escrowCodama.accept(
    renderJavaScriptVisitor(typescriptClientsDir, {
        deleteFolderBeforeRendering: true,
        formatCode: true,
    }),
);

// Restore configuration files after generation
configPreserver.restore();
