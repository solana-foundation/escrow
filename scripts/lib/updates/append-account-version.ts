import { Codama, bottomUpTransformerVisitor, structFieldTypeNode, numberTypeNode, assertIsNode, isNode } from 'codama';

/**
 * Adds version fields to account structs (after discriminator) for versioned deserialization.
 */
export function appendAccountVersion(escrowCodama: Codama): Codama {
    escrowCodama.update(
        bottomUpTransformerVisitor([
            {
                select: '[accountNode]',
                transform: node => {
                    assertIsNode(node, 'accountNode');

                    if (isNode(node.data, 'structTypeNode')) {
                        const fields = node.data.fields ?? [];
                        const discriminatorIndex = fields.findIndex(f => f.name === 'discriminator');

                        const versionField = structFieldTypeNode({
                            name: 'version',
                            type: numberTypeNode('u8'),
                        });

                        const updatedFields =
                            discriminatorIndex >= 0
                                ? [
                                      ...fields.slice(0, discriminatorIndex + 1),
                                      versionField,
                                      ...fields.slice(discriminatorIndex + 1),
                                  ]
                                : [versionField, ...fields];

                        const updatedNode = {
                            ...node,
                            data: {
                                ...node.data,
                                fields: updatedFields,
                            },
                        };

                        if (node.size !== undefined) {
                            return {
                                ...updatedNode,
                                size: (node.size ?? 0) + 1,
                            };
                        }

                        return updatedNode;
                    }

                    return node;
                },
            },
        ]),
    );
    return escrowCodama;
}
