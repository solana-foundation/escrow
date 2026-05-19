/**
 * Escrow Program Demo
 *
 * This demo shows the full escrow workflow:
 * 1. Setup & connect to localhost validator
 * 2. Create an escrow
 * 3. Create a test token mint
 * 4. Allow the mint for deposits
 * 5. Add a timelock extension
 * 6. Deposit tokens
 * 7. Attempt early withdraw (expect failure)
 * 8. Wait for timelock and withdraw successfully
 */

// Escrow program client imports
import {
    ESCROW_PROGRAM_ERROR__TIMELOCK_NOT_EXPIRED,
    findAllowedMintPda,
    findEscrowPda,
    findExtensionsPda,
    findReceiptPda,
    getAddTimelockInstructionAsync,
    getAllowMintInstructionAsync,
    getCreatesEscrowInstructionAsync,
    getDepositInstructionAsync,
    getWithdrawInstructionAsync,
} from '@solana/escrow';
import { generateKeyPairSigner, isSolanaError } from '@solana/kit';
import { createDefaultLocalhostRpcClient } from '@solana/kit-plugins';
import {
    findAssociatedTokenPda,
    getCreateAssociatedTokenIdempotentInstructionAsync,
    getMintToInstruction,
    TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';

// Local utilities
import { CONFIG, formatTokenAmount, sleep, truncateAddress } from './utils/config.js';
import { logAddress, logError, logInfo, logStep, logSuccess, logSummary, logTitle } from './utils/logging.js';
import { createMintInstructions } from './utils/token-setup.js';
import { buildAndSend } from './utils/transaction.js';

logTitle('ESCROW PROGRAM DEMO');

// ============================================================
// Step 1: Setup & Connect
// ============================================================
logStep(1, 'Setup & Connect');

const { rpc, rpcSubscriptions, payer } = await createDefaultLocalhostRpcClient();

// Generate keypairs
const admin = await generateKeyPairSigner();
const escrowSeed = await generateKeyPairSigner();
const receiptSeed = await generateKeyPairSigner();
const mintKeypair = await generateKeyPairSigner();

logAddress('Payer', payer.address);
logAddress('Admin', admin.address);
logSuccess('Connected to localhost validator');

// ============================================================
// Step 2: Create Escrow
// ============================================================
logStep(2, 'Create Escrow');

// Find escrow PDA
const [escrowPda, escrowBump] = await findEscrowPda({
    escrowSeed: escrowSeed.address,
});

logAddress('Escrow Seed', escrowSeed.address);
logInfo('Escrow PDA', truncateAddress(escrowPda));
logInfo('Bump', escrowBump.toString());

const createEscrowIx = await getCreatesEscrowInstructionAsync({
    admin,
    escrowSeed,
    payer,
});

await buildAndSend({ instructions: [createEscrowIx], payer, rpc, rpcSubscriptions });
logSuccess('Escrow created');

// ============================================================
// Step 3: Create Test Token
// ============================================================
logStep(3, 'Create Test Token (Classic SPL Token)');

// Create mint instructions
const mintIxs = await createMintInstructions(
    payer,
    mintKeypair,
    payer.address, // payer is mint authority
    CONFIG.TOKEN_DECIMALS,
    rpc,
);

// Create depositor (payer) ATA
const [depositorAta] = await findAssociatedTokenPda({
    mint: mintKeypair.address,
    owner: payer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
});

const createDepositorAtaIx = await getCreateAssociatedTokenIdempotentInstructionAsync({
    ata: depositorAta,
    mint: mintKeypair.address,
    owner: payer.address,
    payer,
});

// Mint tokens to depositor
const mintToIx = getMintToInstruction({
    amount: CONFIG.MINT_AMOUNT,
    mint: mintKeypair.address,
    mintAuthority: payer,
    token: depositorAta,
});

await buildAndSend({ instructions: [...mintIxs, createDepositorAtaIx, mintToIx], payer, rpc, rpcSubscriptions });

logAddress('Mint', mintKeypair.address);
logAddress('Depositor ATA', depositorAta);
logInfo('Minted', `${formatTokenAmount(CONFIG.MINT_AMOUNT)} tokens`);
logSuccess('Test token created and minted');

// ============================================================
// Step 4: Allow Mint
// ============================================================
logStep(4, 'Allow Mint');

// Find allowed mint PDA
const [allowedMintPda] = await findAllowedMintPda({
    escrow: escrowPda,
    mint: mintKeypair.address,
});

logAddress('Allowed Mint PDA', allowedMintPda);

const allowMintIx = await getAllowMintInstructionAsync({
    admin,
    escrow: escrowPda,
    mint: mintKeypair.address,
    payer,
});

await buildAndSend({ instructions: [allowMintIx], payer, rpc, rpcSubscriptions });

// Find vault ATA (escrow's ATA for this mint)
const [vaultAta] = await findAssociatedTokenPda({
    mint: mintKeypair.address,
    owner: escrowPda,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
});
logAddress('Vault ATA', vaultAta);
logSuccess('Mint allowed for escrow deposits');

// ============================================================
// Step 5: Add Timelock
// ============================================================
logStep(5, 'Add Timelock Extension');

// Find extensions PDA
const [extensionsPda] = await findExtensionsPda({
    escrow: escrowPda,
});

logAddress('Extensions PDA', extensionsPda);
logInfo('Lock Duration', `${CONFIG.TIMELOCK_DURATION} seconds`);

const addTimelockIx = await getAddTimelockInstructionAsync({
    admin,
    escrow: escrowPda,
    lockDuration: CONFIG.TIMELOCK_DURATION,
    payer,
});

await buildAndSend({ instructions: [addTimelockIx], payer, rpc, rpcSubscriptions });
logSuccess('Timelock extension added');

// ============================================================
// Step 6: Deposit
// ============================================================
logStep(6, 'Deposit Tokens');

// Find receipt PDA
const [receiptPda] = await findReceiptPda({
    depositor: payer.address,
    escrow: escrowPda,
    mint: mintKeypair.address,
    receiptSeed: receiptSeed.address,
});

logAddress('Receipt PDA', receiptPda);
logInfo('Deposit Amount', `${formatTokenAmount(CONFIG.DEPOSIT_AMOUNT)} tokens`);

const depositIx = await getDepositInstructionAsync({
    amount: CONFIG.DEPOSIT_AMOUNT,
    depositor: payer,
    escrow: escrowPda,
    mint: mintKeypair.address,
    payer,
    receiptSeed,
});

await buildAndSend({ instructions: [depositIx], payer, rpc, rpcSubscriptions });

// Check vault balance
const vaultBalance = await rpc.getTokenAccountBalance(vaultAta).send();
logInfo('Vault Balance', `${formatTokenAmount(BigInt(vaultBalance.value.amount) ?? 0n)} tokens`);

logSuccess('Deposit successful');

// ============================================================
// Step 7: Early Withdraw (Expect Failure)
// ============================================================
logStep(7, 'Attempt Early Withdraw');

logInfo('Action', 'Trying to withdraw before timelock expires...');

try {
    const earlyWithdrawIx = await getWithdrawInstructionAsync({
        escrow: escrowPda,
        mint: mintKeypair.address,
        receipt: receiptPda,
        rentRecipient: payer.address,
        withdrawer: payer,
    });

    await buildAndSend({ instructions: [earlyWithdrawIx], payer, rpc, rpcSubscriptions, skipComputeEstimate: true });
    // Since we expect our timelock to prevent this withdrawal, this transaction should not succeed
    logError('Withdraw succeeded unexpectedly!');
    throw new Error('Demo Error: Withdraw succeeded unexpectedly!');
} catch (error) {
    if (
        isSolanaError(error) &&
        'code' in error.context &&
        error.context.code === ESCROW_PROGRAM_ERROR__TIMELOCK_NOT_EXPIRED
    ) {
        logError('Withdraw failed as expected: Timelock not expired');
        // error is expected for this demo, continue the flow
    } else {
        logError(`Withdraw failed with unexpected error`);
        throw error;
    }
}

// ============================================================
// Step 8: Wait & Withdraw
// ============================================================
logStep(8, 'Wait for Timelock & Withdraw');

logInfo('Waiting', `${CONFIG.TIMELOCK_WAIT_MS / 1000} seconds...`);
await sleep(CONFIG.TIMELOCK_WAIT_MS);

const withdrawIx = await getWithdrawInstructionAsync({
    escrow: escrowPda,
    mint: mintKeypair.address,
    receipt: receiptPda,
    rentRecipient: payer.address,
    withdrawer: payer,
});

await buildAndSend({ instructions: [withdrawIx], payer, rpc, rpcSubscriptions });

// Check final depositor balance
const finalAccountBalance = await rpc.getTokenAccountBalance(depositorAta).send();
logInfo('Final Depositor Balance', `${formatTokenAmount(BigInt(finalAccountBalance.value.amount))} tokens`);

logSuccess('Withdraw successful!');

// ============================================================
// Summary
// ============================================================
logSummary(escrowPda, mintKeypair.address);
