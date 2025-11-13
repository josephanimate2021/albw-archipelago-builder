import os
import orjson
import shutil
import tempfile
from dataclasses import dataclass
from typing import Any, ClassVar, Dict, Optional
from worlds.Files import APProcedurePatch, AutoPatchExtensionRegister
from Patch import create_rom_file
from Utils import Version, tuplize_version
from settings import get_settings
from .Items import item_table, APItem
from .Options import (ALBWSpecificOptions, ALBWSpecificOptionsClasses, create_randomizer_settings)
from albwrandomizer import ArchipelagoItem, ArchipelagoInfo, logging_on, randomize_pre_fill

class PatchItemInfo:
    name: str
    classification: int

    def __init__(self, name: str, classification: int):
        self.name = name
        self.classification = classification

class PatchInfo:
    version: str
    seed: int
    player_name: str
    options: ALBWSpecificOptions
    check_map: Dict[str, str]
    items: Dict[str, PatchItemInfo]

    cur_version: ClassVar[Version] = Version(0, 1, 3)
    min_compatible_version: ClassVar[Version] = Version(0, 1, 3)

    def __init__(
        self,
        version: str,
        seed: int,
        player_name: str,
        options: ALBWSpecificOptions,
        check_map: Dict[str, str],
        items: Dict[str, PatchItemInfo],
    ):
        self.version = version
        self.seed = seed
        self.player_name = player_name
        self.options = options
        self.check_map = check_map
        self.items = items
    
    def to_json(self) -> str:
        return orjson.dumps({
            "version": self.version,
            "seed": self.seed,
            "player_name": self.player_name,
            "options": self.options.as_dict(
                OPTIONSDICT
            ),
            "check_map": self.check_map,
            "items": {key: val.__dict__ for key, val in self.items.items()}
        })
    
def from_json(json: str) -> PatchInfo:
    info = orjson.loads(json)
    return PatchInfo(
        info["version"],
        info["seed"],
        info["player_name"],
        ALBWSpecificOptions(
            ALBWSpecificOptionsStuff
        ),
        info["check_map"],
        {loc: PatchItemInfo(item["name"], item["classification"]) for loc, item in info["items"].items()}
    )

class ALBWProcedurePatch(APProcedurePatch):
    game: str = "A Link Between Worlds"
    hash: Optional[str] = None
    patch_file_ending: str = ".apalbw"
    result_file_ending: str = ".zip"
    rom_file: str = ""

    procedure = [
        ("patch_albw", ["patch_info.json"])
    ]

    @classmethod
    def get_source_data(cls) -> bytes:
        cls.rom_file = get_settings().albw_settings.rom_file
        logging_on()

        return b""

class ALBWPatchExtension(metaclass=AutoPatchExtensionRegister):
    game: str = "A Link Between Worlds"

    @staticmethod
    def patch_albw(caller: ALBWProcedurePatch, rom: bytes, patch_name: str) -> bytes:
        # Load patch info from the json file
        patch_info = from_json(caller.get_file(patch_name))

        # Check patch version
        version = tuplize_version(patch_info.version)
        if version > PatchInfo.cur_version:
            raise Exception(f"The patch file was generated on a newer version of the apworld. \
                Please update to version {patch_info.version}.")
        elif version < PatchInfo.min_compatible_version:
            raise Exception(f"The patch file was generated on an older version of the apworld. \
                For compatibility, you must downgrade to version {patch_info.version}.")

        # Load Archipelago info from the patch info
        archipelago_info = ArchipelagoInfo()
        archipelago_info.name = patch_info.player_name
        archipelago_info.items = {loc_name: ArchipelagoItem(item.name, item.classification)
                                    for loc_name, item in patch_info.items.items()}

        # Initialize seed info from the patch info
        settings = create_randomizer_settings(patch_info.options)
        seed_info = randomize_pre_fill(patch_info.seed, settings, archipelago_info)
        check_map = {loc_name: item_table[item_name].progress[0] if item_name != "AP Item" else APItem
            for loc_name, item_name in patch_info.check_map.items()}
        seed_info.build_layout(check_map)

        with tempfile.TemporaryDirectory() as output_directory:
            # Create the patch
            output_subdirectory = os.path.join(output_directory, f"tmp_apalbw_{caller.player}")
            os.mkdir(output_subdirectory)
            seed_info.patch(caller.rom_file, output_subdirectory)

            # Put the patch in a zip file
            output_path = os.path.join(output_directory, f"tmp_apalbw_{caller.player}.zip")
            shutil.make_archive(output_subdirectory, "zip", output_subdirectory)

            # Output the contents of the zip file
            with open(output_path, "rb") as output_file:
                output = output_file.read()
            return output

if __name__ == "__main__":
    create_rom_file(sys.argv[1])
