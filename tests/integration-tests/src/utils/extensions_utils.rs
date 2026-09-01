const TLV_HEADER_SIZE: usize = 4;

pub const EXTENSION_TYPE_TIMELOCK: u16 = 0;
pub const EXTENSION_TYPE_HOOK: u16 = 1;
pub const EXTENSION_TYPE_BLOCK_TOKEN_EXTENSIONS: u16 = 2;
pub const EXTENSION_TYPE_ARBITER: u16 = 3;
pub const EXTENSION_TYPE_SETTLEMENT: u16 = 4;

/// SettlementData on-wire length (matches `SettlementData::LEN` in the program).
pub const SETTLEMENT_DATA_LEN: usize = 102;

pub const ESCROW_EXTENSIONS_DISCRIMINATOR: u8 = 2;
pub const ESCROW_EXTENSIONS_HEADER_LEN: usize = 4; // discriminator + bump + version + extension_count

pub const TIMELOCK_DATA_LEN: usize = 8;
pub const HOOK_DATA_LEN: usize = 32;
pub const ARBITER_DATA_LEN: usize = 32;

/// Calculate the expected byte length for block token extensions data
pub fn block_token_extensions_byte_len(count: usize) -> usize {
    1 + (count * 2) // count (1) + blocked_extensions (count * 2)
}

pub fn find_extension(account_data: &[u8], ext_type: u16) -> Option<&[u8]> {
    let mut offset = ESCROW_EXTENSIONS_HEADER_LEN;

    while offset + TLV_HEADER_SIZE <= account_data.len() {
        let type_bytes = u16::from_le_bytes(account_data[offset..offset + 2].try_into().unwrap());
        let length = u16::from_le_bytes(account_data[offset + 2..offset + 4].try_into().unwrap()) as usize;

        if offset + TLV_HEADER_SIZE + length > account_data.len() {
            break;
        }

        if type_bytes == ext_type {
            return Some(&account_data[offset + TLV_HEADER_SIZE..offset + TLV_HEADER_SIZE + length]);
        }

        offset += TLV_HEADER_SIZE + length;
    }
    None
}
