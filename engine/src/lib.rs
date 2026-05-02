use wasm_bindgen::prelude::*;
use rand::RngCore;
use k256::ecdsa::SigningKey;
use k256::elliptic_curve::sec1::ToEncodedPoint;
use sha3::{Digest, Keccak256};
use zeroize::Zeroize;

#[wasm_bindgen]
pub struct MatchResult {
    private_key: String,
    address: String,
}

#[wasm_bindgen]
impl MatchResult {
    #[wasm_bindgen(getter)]
    pub fn private_key(&self) -> String {
        self.private_key.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn address(&self) -> String {
        self.address.clone()
    }
}

// Convert hex string to byte array and mask
fn parse_hex_pattern(hex_str: &str) -> (Vec<u8>, Vec<u8>) {
    let mut clean_str = hex_str.to_lowercase();
    if clean_str.starts_with("0x") {
        clean_str = clean_str[2..].to_string();
    }
    
    let is_odd = clean_str.len() % 2 != 0;
    if is_odd {
        clean_str.push('0'); // Pad for parsing
    }
    
    let byte_len = clean_str.len() / 2;
    let mut bytes = vec![0u8; byte_len];
    let mut mask = vec![0u8; byte_len];
    
    for i in 0..byte_len {
        let byte_str = &clean_str[i * 2..i * 2 + 2];
        let byte = u8::from_str_radix(byte_str, 16).unwrap_or(0);
        
        bytes[i] = byte;
        
        if is_odd && i == byte_len - 1 {
            mask[i] = 0xF0;
            bytes[i] = bytes[i] & 0xF0;
        } else {
            mask[i] = 0xFF;
        }
    }
    
    (bytes, mask)
}

#[wasm_bindgen]
pub struct VanityEngine;

#[wasm_bindgen]
impl VanityEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self
    }

    #[wasm_bindgen]
    pub fn search_batch(
        &self,
        prefix: &str,
        suffix: &str,
        batch_size: usize,
    ) -> Option<MatchResult> {
        let (prefix_bytes, prefix_mask) = parse_hex_pattern(prefix);
        let (suffix_bytes, suffix_mask) = parse_hex_pattern(suffix);
        
        let prefix_len = prefix_bytes.len();
        let suffix_len = suffix_bytes.len();

        let mut private_key = [0u8; 32];
        let mut rng = rand::thread_rng();

        for _ in 0..batch_size {
            rng.fill_bytes(&mut private_key);

            let signing_key = match SigningKey::from_slice(&private_key) {
                Ok(k) => k,
                Err(_) => continue, // Invalid scalar, very rare
            };
            
            let verifying_key = signing_key.verifying_key();
            let encoded_point = verifying_key.to_encoded_point(false);
            let pubkey_bytes = encoded_point.as_bytes(); // first byte is 0x04

            let mut hasher = Keccak256::new();
            hasher.update(&pubkey_bytes[1..]);
            let hash = hasher.finalize();

            let address = &hash[12..32];

            let mut is_match = true;
            for i in 0..prefix_len {
                if (address[i] & prefix_mask[i]) != prefix_bytes[i] {
                    is_match = false;
                    break;
                }
            }

            if is_match {
                let offset = 20 - suffix_len;
                if offset >= 0 {
                    for i in 0..suffix_len {
                        if (address[offset + i] & suffix_mask[i]) != suffix_bytes[i] {
                            is_match = false;
                            break;
                        }
                    }
                } else {
                    is_match = false;
                }

                if is_match {
                    let priv_hex = format!("0x{}", hex::encode(private_key));
                    let addr_hex = format!("0x{}", hex::encode(address));
                    
                    private_key.zeroize();
                    
                    return Some(MatchResult {
                        private_key: priv_hex,
                        address: addr_hex,
                    });
                }
            }
        }

        private_key.zeroize();
        None
    }
}
