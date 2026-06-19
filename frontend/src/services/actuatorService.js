// ============================================================
// ActuatorService - Actuator data management
// ============================================================

var ActuatorService = (function() {
    function getActuadorId(deviceId, macetaNum, tipo) {
        return (deviceId - 1) * 13 + (macetaNum - 1) * 3 + tipo;
    }

    function getBuzzerId(deviceId) {
        return (deviceId - 1) * 13 + 13;
    }

    function getActuadoresByDevice(deviceId) {
        return ApiService.sbQuery('actuadores', 'dispositivo_id=eq.' + deviceId + '&order=id.asc');
    }

    function getActuadoresByMaceta(deviceId, macetaNum) {
        return ApiService.sbQuery('actuadores', 'dispositivo_id=eq.' + deviceId + '&maceta_num=eq.' + macetaNum);
    }

    function toggleActuador(actuadorId, nombre, pin, estado, dispositivoId) {
        return ApiService.sbInsert('control_actuadores', {
            actuador_id: actuadorId,
            dispositivo_id: dispositivoId,
            nombre_actuador: nombre,
            pin_conexion: pin,
            estado_solicitado: estado
        });
    }

    function fetchActuadores(invIndex) {
        var deviceId = invIndex + 1;
        return getActuadoresByDevice(deviceId).then(function(data) {
            if (data) AppState.set('actuators', data);
            return data;
        });
    }

    return {
        getActuadorId: getActuadorId,
        getBuzzerId: getBuzzerId,
        getActuadoresByDevice: getActuadoresByDevice,
        getActuadoresByMaceta: getActuadoresByMaceta,
        toggleActuador: toggleActuador,
        fetchActuadores: fetchActuadores
    };
})();

if (typeof window !== 'undefined') window.ActuatorService = ActuatorService;
