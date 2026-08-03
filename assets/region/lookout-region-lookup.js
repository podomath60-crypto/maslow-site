(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MaslowLookoutRegionLookup = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function text(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function digits(value) {
    return text(value).replace(/\D/g, "");
  }

  function unique(values) {
    var seen = Object.create(null);
    var result = [];
    (values || []).forEach(function (value) {
      var normalized = text(value);
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      result.push(normalized);
    });
    return result;
  }

  function firstNonEmpty() {
    for (var i = 0; i < arguments.length; i += 1) {
      var value = text(arguments[i]);
      if (value) return value;
    }
    return "";
  }

  function getLandObject(response) {
    if (!response || typeof response !== "object") return null;
    if (response.land && typeof response.land === "object") return response.land;
    if (response.characteristic || response.usePlan || response.pnu) return response;
    return null;
  }

  function hasBuildingData(response) {
    if (!response || typeof response !== "object") return false;
    if (Array.isArray(response.hitApis) && response.hitApis.length > 0) return true;
    var apis = response.apis && typeof response.apis === "object" ? response.apis : {};
    return Object.keys(apis).some(function (key) {
      var api = apis[key] || {};
      return Number(api.itemCount || api.totalCount || 0) > 0;
    });
  }

  function hasMeaningfulLandData(response) {
    var land = getLandObject(response);
    if (!land || land.ok === false) return false;

    var characteristic = land.characteristic || {};
    var usePlan = land.usePlan || {};
    var meaningfulValues = [
      characteristic.landCategory,
      characteristic.areaM2,
      characteristic.areaPy,
      characteristic.zoning,
      characteristic.zoning2,
      characteristic.landUseSituation,
      characteristic.terrainHeight,
      characteristic.terrainShape,
      characteristic.roadSide,
      characteristic.officialLandPrice,
      characteristic.officialLandPriceText,
      usePlan.ledgerType,
      usePlan.conflictStatus,
      usePlan.zoningDistricts
    ];

    return meaningfulValues.some(function (value) {
      return text(value) !== "";
    });
  }

  function buildMessage(buildingFound, landFound, fallbackMessage) {
    if (buildingFound && landFound) return "조회 성공";
    if (buildingFound) return "건축물대장 조회 성공 · 토지정보는 확인하지 못했습니다.";
    if (landFound) return "토지정보 조회 성공 · 건축물대장 결과가 없습니다.";
    return text(fallbackMessage) || "조회 결과가 없습니다.";
  }

  function create(options) {
    options = options || {};
    var resolver = options.resolver || null;
    var lookup = options.lookup;
    if (typeof lookup !== "function") throw new Error("lookup function is required");

    function bcodeCandidates(input) {
      var code = digits(input);
      var resolved = resolver && typeof resolver.getBcodeCandidates === "function"
        ? resolver.getBcodeCandidates(code)
        : [];
      var candidates = unique(resolved);
      if (!candidates.length && code.length === 10) candidates.push(code);
      return candidates;
    }

    function pnuCandidates(input) {
      var pnu = digits(input);
      var resolved = resolver && typeof resolver.getPnuCandidates === "function"
        ? resolver.getPnuCandidates(pnu)
        : [];
      var candidates = unique(resolved);
      if (!candidates.length && pnu.length === 19) candidates.push(pnu);
      return candidates;
    }

    function normalizeLandQuery(query) {
      var original = text(query);
      if (!original) return "";
      if (!resolver || typeof resolver.getCurrentAddress !== "function") return original;
      return text(resolver.getCurrentAddress(original)) || original;
    }

    async function lookupIntegrated(params) {
      params = Object.assign({}, params || {});
      var candidates = bcodeCandidates(params.bcode);
      var attempts = [];
      var successes = [];
      var buildingSource = null;
      var landSource = null;
      var lastError = null;

      for (var i = 0; i < candidates.length; i += 1) {
        var candidate = candidates[i];
        try {
          var response = await lookup(
            Object.assign({}, params, { bcode: candidate }),
            {
              kind: "bcode",
              value: candidate,
              index: i + 1,
              total: candidates.length,
              label: "법정동 후보 " + (i + 1) + "/" + candidates.length + " · " + candidate
            }
          );
          var success = { value: candidate, response: response };
          successes.push(success);
          attempts.push({
            value: candidate,
            ok: !!(response && response.ok),
            building: hasBuildingData(response),
            land: hasMeaningfulLandData(response),
            message: text(response && response.message)
          });
          if (!buildingSource && hasBuildingData(response)) buildingSource = success;
          if (!landSource && hasMeaningfulLandData(response)) landSource = success;
          if (buildingSource && landSource) break;
        } catch (error) {
          lastError = error;
          attempts.push({
            value: candidate,
            ok: false,
            building: false,
            land: false,
            message: text(error && error.message) || String(error)
          });
        }
      }

      if (!successes.length) {
        throw lastError || new Error("법정동 후보 조회 실패");
      }

      var base = successes[0].response || {};
      var merged = Object.assign({}, base);
      if (buildingSource) {
        merged.apis = buildingSource.response.apis || {};
        merged.hitApis = buildingSource.response.hitApis || [];
        merged.codeInfo = buildingSource.response.codeInfo || {};
      }
      if (landSource) {
        merged.land = getLandObject(landSource.response);
        merged.pnu = firstNonEmpty(
          landSource.response && landSource.response.pnu,
          merged.land && merged.land.pnu
        );
      }

      var currentAddress = firstNonEmpty(
        params.lookupAddress,
        params.jibunAddress,
        params.queryAddress,
        params.roadAddress,
        base.address
      );
      if (currentAddress) merged.address = currentAddress;
      merged.message = buildMessage(!!buildingSource, !!landSource, base.message);
      merged.compatibilityResolution = {
        inputBcode: digits(params.bcode),
        candidates: candidates.slice(),
        buildingBcode: buildingSource ? buildingSource.value : "",
        landPnu: landSource
          ? firstNonEmpty(landSource.response && landSource.response.pnu, getLandObject(landSource.response) && getLandObject(landSource.response).pnu)
          : "",
        attempts: attempts
      };

      return {
        response: merged,
        candidates: candidates,
        attempts: attempts
      };
    }

    async function lookupLand(params) {
      params = Object.assign({}, params || {});
      var candidates = pnuCandidates(params.pnu);
      var attempts = [];
      var successes = [];
      var chosen = null;
      var lastError = null;

      for (var i = 0; i < candidates.length; i += 1) {
        var candidate = candidates[i];
        try {
          var response = await lookup(
            Object.assign({}, params, { pnu: candidate }),
            {
              kind: "pnu",
              value: candidate,
              index: i + 1,
              total: candidates.length,
              label: "PNU 후보 " + (i + 1) + "/" + candidates.length + " · " + candidate
            }
          );
          var success = { value: candidate, response: response };
          successes.push(success);
          var meaningful = hasMeaningfulLandData(response);
          attempts.push({
            value: candidate,
            ok: !!(response && response.ok),
            land: meaningful,
            message: text(response && response.message)
          });
          if (meaningful) {
            chosen = success;
            break;
          }
        } catch (error) {
          lastError = error;
          attempts.push({
            value: candidate,
            ok: false,
            land: false,
            message: text(error && error.message) || String(error)
          });
        }
      }

      if (!chosen) chosen = successes[0] || null;
      if (!chosen) throw lastError || new Error("PNU 후보 조회 실패");

      return {
        response: chosen.response,
        pnu: chosen.value,
        candidates: candidates,
        attempts: attempts,
        meaningful: hasMeaningfulLandData(chosen.response)
      };
    }

    return {
      normalizeLandQuery: normalizeLandQuery,
      getBcodeCandidates: bcodeCandidates,
      getPnuCandidates: pnuCandidates,
      lookupIntegrated: lookupIntegrated,
      lookupLand: lookupLand
    };
  }

  return {
    create: create,
    getLandObject: getLandObject,
    hasBuildingData: hasBuildingData,
    hasMeaningfulLandData: hasMeaningfulLandData
  };
});
