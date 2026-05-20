import {
    appendTransactionMessageInstructions,
    assertIsTransactionWithBlockhashLifetime,
    createTransactionMessage,
    getSignatureFromTransaction,
    type Instruction,
    pipe,
    sendAndConfirmTransactionFactory,
    setTransactionMessageFeePayerSigner,
    setTransactionMessageLifetimeUsingBlockhash,
    signTransactionMessageWithSigners,
    type TransactionSigner,
} from '@solana/kit';
import { useCallback } from 'react';

import { useRpc, useRpcSubscriptions } from '@/hooks/useRpc';

export function useWalletTransactionSignAndSend() {
    const rpc = useRpc();
    const rpcSubscriptions = useRpcSubscriptions();

    return useCallback(
        async (instructions: readonly Instruction[], signer: TransactionSigner): Promise<string> => {
            const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
            const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

            const txMessage = pipe(
                createTransactionMessage({ version: 0 }),
                tx => setTransactionMessageFeePayerSigner(signer, tx),
                tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
                tx => appendTransactionMessageInstructions(instructions, tx),
            );

            const signedTx = await signTransactionMessageWithSigners(txMessage);
            const signature = getSignatureFromTransaction(signedTx);
            assertIsTransactionWithBlockhashLifetime(signedTx);

            await sendAndConfirm(signedTx, {
                commitment: 'confirmed',
            });

            return signature;
        },
        [rpc, rpcSubscriptions],
    );
}
