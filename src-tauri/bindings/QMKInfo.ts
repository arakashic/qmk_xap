// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { QMKBoardIdentifiers } from "./QMKBoardIdentifiers";

export interface QMKInfo { version: string, board_ids: QMKBoardIdentifiers | null, manufacturer: string | null, product_name: string | null, config: string | null, hardware_id: string | null, jump_to_bootloader: boolean, eeprom_reset: boolean, }