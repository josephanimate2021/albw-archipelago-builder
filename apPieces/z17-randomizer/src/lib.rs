use pyo3::prelude::*;
use modinfo::settings::{
    RANDO_SETTINGS_CLASSES
};
use modinfo::Settings;
use randomizer::{ArchipelagoItem, ArchipelagoInfo, SeedInfo, randomize_pre_fill};
use randomizer::filler::filler_item::{
    Item, Goal, Vane, Crack, PyRandomizable,
    new_item, new_goal, new_vane, new_crack
};
use simplelog::{LevelFilter, SimpleLogger};

#[pyfunction]
pub fn logging_on() {
    SimpleLogger::init(LevelFilter::Info, Default::default()).expect("Could not initialize logger.");
}

#[pymodule]
fn albwrandomizer(_py: Python<'_>, m: &PyModule) -> PyResult<()> {
    M_ADD_CLASS_SETTINGS
    m.add_class::<Settings>()?;
    m.add_class::<ArchipelagoItem>()?;
    m.add_class::<ArchipelagoInfo>()?;
    m.add_class::<SeedInfo>()?;
    m.add_class::<Item>()?;
    m.add_class::<Goal>()?;
    m.add_class::<Vane>()?;
    m.add_class::<Crack>()?;
    m.add_class::<PyRandomizable>()?;

    m.add_function(wrap_pyfunction!(logging_on, m)?)?;
    m.add_function(wrap_pyfunction!(randomize_pre_fill, m)?)?;
    m.add_function(wrap_pyfunction!(new_item, m)?)?;
    m.add_function(wrap_pyfunction!(new_goal, m)?)?;
    m.add_function(wrap_pyfunction!(new_vane, m)?)?;
    m.add_function(wrap_pyfunction!(new_crack, m)?)?;
    Ok(())
}
