if self.options.weather_vanes in [WeatherVanes.option_hyrule, WeatherVanes.option_all]:
            starting_vanes += hyrule_vanes
        if self.options.weather_vanes in [WeatherVanes.option_lorule, WeatherVanes.option_all]:
            starting_vanes += lorule_vanes
        if self.options.weather_vanes == WeatherVanes.option_convenient:
            starting_vanes += convenient_hyrule_vanes
            if not self.options.crack_shuffle == CrackShuffle.option_off:
                starting_vanes += convenient_lorule_vanes