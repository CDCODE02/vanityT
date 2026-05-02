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
        prefix: &[u8],
        suffix: &[u8],
        batch_size: usize,
    ) -> Option<MatchResult> {
        let prefix_len = prefix.len();
        let suffix_len = suffix.len();

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
                if address[i] != prefix[i] {
                    is_match = false;
                    break;
                }
            }

            if is_match {
                let offset = 20 - suffix_len;
                if offset >= 0 {
                    for i in 0..suffix_len {
                        if address[offset + i] != suffix[i] {
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
