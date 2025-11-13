from dataclasses import dataclass
from typing import Dict
from Options import PerGameCommonOptions, Choice, Range, Toggle
import albwrandomizer

ALBWOPTIONS

SPECIFIC_OPTIONS

@dataclass
class ALBWOptions(PerGameCommonOptions, ALBWSpecificOptions):
    pass

CREATE_RANDOMIZER_SETTINGS