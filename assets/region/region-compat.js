(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MaslowRegionCompat = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEFAULT_CURRENT_URL = "/assets/region/bjdong-codes-current-20260701.json";
  var DEFAULT_COMPAT_URL = "/assets/region/bjdong-compat-20260701.json";

  function toText(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  var REGION_PREFIX_ALIASES = [
    ["전남광주시", "전남광주통합특별시"],
    ["서울", "서울특별시"],
    ["부산", "부산광역시"],
    ["대구", "대구광역시"],
    ["인천", "인천광역시"],
    ["광주", "광주광역시"],
    ["대전", "대전광역시"],
    ["울산", "울산광역시"],
    ["세종", "세종특별자치시"],
    ["경기", "경기도"],
    ["강원", "강원특별자치도"],
    ["충북", "충청북도"],
    ["충남", "충청남도"],
    ["전북", "전북특별자치도"],
    ["전남", "전라남도"],
    ["경북", "경상북도"],
    ["경남", "경상남도"],
    ["제주", "제주특별자치도"]
  ];

  function normalizeBaseText(value) {
    var text = toText(value);
    try {
      text = text.normalize("NFKC");
    } catch (_) {}
    return text.replace(/^대한민국\s+/, "").replace(/\s+/g, " ").trim();
  }

  function expandRegionPrefix(text) {
    for (var i = 0; i < REGION_PREFIX_ALIASES.length; i += 1) {
      var alias = REGION_PREFIX_ALIASES[i][0];
      var canonical = REGION_PREFIX_ALIASES[i][1];
      if (text === alias || text.indexOf(alias + " ") === 0) {
        return canonical + text.slice(alias.length);
      }
    }
    return text;
  }

  function normalizeText(value) {
    return expandRegionPrefix(normalizeBaseText(value));
  }

  function digits(value) {
    return toText(value).replace(/\D/g, "");
  }

  function unique(values) {
    var out = [];
    var seen = Object.create(null);
    values.forEach(function (value) {
      var key = toText(value);
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(key);
    });
    return out;
  }

  function validBcode(value) {
    var code = digits(value);
    return code.length === 10 ? code : "";
  }

  function validPnu(value) {
    var pnu = digits(value);
    return pnu.length === 19 ? pnu : "";
  }

  function startsWithLegalName(address, name) {
    if (!address || !name) return false;
    return address === name || address.indexOf(name + " ") === 0;
  }

  function replacePrefix(address, fromName, toName) {
    if (!startsWithLegalName(address, fromName)) return address;
    return toName + address.slice(fromName.length);
  }

  function parentName(fullName, bname) {
    var name = normalizeText(fullName);
    var tail = normalizeText(bname);
    if (!name || !tail || !name.endsWith(tail)) return "";
    return name.slice(0, name.length - tail.length).trim();
  }

  function createResolver(options) {
    options = options || {};
    var currentData = options.currentData || {};
    var compatData = options.compatData || {};
    var currentRecords = Array.isArray(currentData.records) ? currentData.records : [];
    var mappings = Array.isArray(compatData.mappings) ? compatData.mappings : [];

    var currentByCode = new Map();
    var mappingByLegacyCode = new Map();
    var mappingByCurrentCode = new Map();
    var nameEntries = [];
    var canonicalAliases = new Map();

    currentRecords.forEach(function (record) {
      var code = validBcode(record && record.code);
      if (!code) return;
      var normalized = {
        code: code,
        name: normalizeText(record.name),
        sido: normalizeText(record.sido),
        sigungu: normalizeText(record.sigungu),
        bname: normalizeText(record.bname),
        createdDate: toText(record.createdDate)
      };
      currentByCode.set(code, normalized);
      if (normalized.name) {
        nameEntries.push({ name: normalized.name, kind: "current", code: code });
      }
    });

    mappings.forEach(function (mapping) {
      var legacyCode = validBcode(mapping && mapping.legacyCode);
      var currentCode = validBcode(mapping && mapping.currentCode);
      if (!legacyCode || !currentCode) return;
      var normalized = {
        legacyCode: legacyCode,
        legacyName: normalizeText(mapping.legacyName),
        currentCode: currentCode,
        currentName: normalizeText(mapping.currentName),
        effectiveDate: toText(mapping.effectiveDate || compatData.effectiveDate),
        mappingType: toText(mapping.mappingType),
        changeGroup: normalizeText(mapping.changeGroup)
      };
      mappingByLegacyCode.set(legacyCode, normalized);
      mappingByCurrentCode.set(currentCode, normalized);
      if (normalized.legacyName) {
        nameEntries.push({ name: normalized.legacyName, kind: "legacy", code: legacyCode });
      }
    });

    // Longest exact legal-dong prefix wins. Partial dong-name guessing is prohibited.
    nameEntries.sort(function (a, b) {
      return b.name.length - a.name.length || a.name.localeCompare(b.name, "ko");
    });

    // Build only unambiguous parent aliases for matching/search normalization.
    var aliasTargets = new Map();
    mappings.forEach(function (mapping) {
      var legacy = mappingByLegacyCode.get(validBcode(mapping.legacyCode));
      var currentRecord = currentByCode.get(validBcode(mapping.currentCode));
      if (!legacy || !currentRecord) return;

      var legacyParts = legacy.legacyName.split(" ");
      var currentParts = legacy.currentName.split(" ");
      var legacySido = legacyParts[0] || "";
      var currentSido = currentParts[0] || "";
      if (legacySido && currentSido) addAliasTarget(aliasTargets, legacySido, currentSido);

      var legacyParent = parentName(legacy.legacyName, currentRecord.bname);
      var currentParent = parentName(legacy.currentName, currentRecord.bname);
      if (legacyParent && currentParent) addAliasTarget(aliasTargets, legacyParent, currentParent);
    });
    aliasTargets.forEach(function (targets, alias) {
      if (targets.size === 1) canonicalAliases.set(alias, Array.from(targets)[0]);
    });
    var aliasEntries = Array.from(canonicalAliases.entries()).sort(function (a, b) {
      return b[0].length - a[0].length || a[0].localeCompare(b[0], "ko");
    });

    function addAliasTarget(container, alias, target) {
      if (!container.has(alias)) container.set(alias, new Set());
      container.get(alias).add(target);
    }

    function resolveByCode(input) {
      var code = validBcode(input);
      if (!code) return unresolved("INVALID_BCODE", input);
      var legacyMapping = mappingByLegacyCode.get(code);
      if (legacyMapping) return resolvedFromMapping(legacyMapping, "legacy-code", code);
      var currentMapping = mappingByCurrentCode.get(code);
      if (currentMapping) return resolvedFromMapping(currentMapping, "current-code", code);
      var current = currentByCode.get(code);
      if (current) {
        return {
          resolved: true,
          matchedBy: "current-code",
          inputCode: code,
          inputName: current.name,
          currentCode: code,
          currentName: current.name,
          legacyCodes: [],
          legacyNames: [],
          bcodeCandidates: [code],
          mappingType: "unchanged",
          changeGroup: "",
          effectiveDate: toText(currentData.effectiveDate)
        };
      }
      return unresolved("BCODE_NOT_FOUND", input);
    }

    function resolvedFromMapping(mapping, matchedBy, inputCode) {
      var inputIsLegacy = inputCode === mapping.legacyCode;
      return {
        resolved: true,
        matchedBy: matchedBy,
        inputCode: inputCode,
        inputName: inputIsLegacy ? mapping.legacyName : mapping.currentName,
        currentCode: mapping.currentCode,
        currentName: mapping.currentName,
        legacyCodes: [mapping.legacyCode],
        legacyNames: [mapping.legacyName],
        bcodeCandidates: inputIsLegacy
          ? [mapping.legacyCode, mapping.currentCode]
          : [mapping.currentCode, mapping.legacyCode],
        mappingType: mapping.mappingType || "1:1",
        changeGroup: mapping.changeGroup,
        effectiveDate: mapping.effectiveDate
      };
    }

    function resolveByAddress(input) {
      var originalAddress = normalizeBaseText(input);
      var address = normalizeText(input);
      if (!address) return unresolved("EMPTY_ADDRESS", input);
      for (var i = 0; i < nameEntries.length; i += 1) {
        var entry = nameEntries[i];
        if (!startsWithLegalName(address, entry.name)) continue;
        var byCode = resolveByCode(entry.code);
        if (!byCode.resolved) continue;
        byCode.inputAddress = originalAddress;
        byCode.normalizedAddress = address;
        byCode.matchedName = entry.name;
        byCode.matchedBy = entry.kind + "-name";
        byCode.addressCandidates = getAddressCandidatesFromResolution(originalAddress, byCode);
        return byCode;
      }
      return unresolved("NO_EXACT_LEGAL_DONG_PREFIX", input);
    }

    function getBcodeCandidates(input) {
      if (input && typeof input === "object") {
        var objectCode = input.bcode || input.code || input.legalDongCode || input.pnu;
        if (objectCode) return getBcodeCandidates(objectCode);
        var objectAddress = input.address || input.jibunAddress || input.roadAddress;
        if (objectAddress) return getBcodeCandidates(objectAddress);
      }
      var raw = toText(input);
      var numeric = digits(raw);
      var resolution;
      if (numeric.length === 19) resolution = resolveByCode(numeric.slice(0, 10));
      else if (numeric.length === 10) resolution = resolveByCode(numeric);
      else resolution = resolveByAddress(raw);
      return resolution.resolved ? unique(resolution.bcodeCandidates || []) : [];
    }

    function analyzePnu(input) {
      var pnu = validPnu(input);
      if (!pnu) return unresolved("INVALID_PNU", input);
      var prefix = pnu.slice(0, 10);
      var suffix = pnu.slice(10);
      var resolution = resolveByCode(prefix);
      if (!resolution.resolved) {
        return {
          resolved: true,
          matchedBy: "unchanged-pnu",
          inputPnu: pnu,
          currentPnu: pnu,
          legacyPnus: [],
          pnuCandidates: [pnu],
          bcodeCandidates: [prefix],
          suffix: suffix,
          mappingType: "unchanged"
        };
      }
      var pnuCandidates = resolution.bcodeCandidates.map(function (code) {
        return code + suffix;
      });
      var currentPnu = resolution.currentCode + suffix;
      var legacyPnus = resolution.legacyCodes.map(function (code) {
        return code + suffix;
      });
      return {
        resolved: true,
        matchedBy: resolution.matchedBy,
        inputPnu: pnu,
        currentPnu: currentPnu,
        legacyPnus: legacyPnus,
        pnuCandidates: unique(pnuCandidates),
        bcodeCandidates: resolution.bcodeCandidates.slice(),
        suffix: suffix,
        mappingType: resolution.mappingType,
        changeGroup: resolution.changeGroup,
        effectiveDate: resolution.effectiveDate
      };
    }

    function getPnuCandidates(input) {
      var result = analyzePnu(input);
      return result.resolved ? result.pnuCandidates.slice() : [];
    }

    function getAddressCandidates(input) {
      var originalAddress = normalizeBaseText(input);
      var resolution = resolveByAddress(originalAddress);
      return resolution.resolved
        ? getAddressCandidatesFromResolution(originalAddress, resolution)
        : originalAddress ? [originalAddress] : [];
    }

    function getAddressCandidatesFromResolution(originalAddress, resolution) {
      var normalizedAddress = resolution.normalizedAddress || normalizeText(originalAddress);
      var candidates = [normalizeBaseText(originalAddress)];
      if (normalizedAddress && normalizedAddress !== candidates[0]) {
        candidates.push(normalizedAddress);
      }
      var matched = resolution.matchedName || resolution.inputName || "";
      if (resolution.currentName && matched && matched !== resolution.currentName) {
        candidates.push(replacePrefix(normalizedAddress, matched, resolution.currentName));
      }
      (resolution.legacyNames || []).forEach(function (legacyName) {
        if (matched && legacyName !== matched) {
          candidates.push(replacePrefix(normalizedAddress, matched, legacyName));
        }
      });
      return unique(candidates);
    }

    function getCurrentAddress(input) {
      var originalAddress = normalizeBaseText(input);
      var resolution = resolveByAddress(originalAddress);
      if (!resolution.resolved || !resolution.currentName || !resolution.matchedName) return normalizeText(originalAddress);
      var normalizedAddress = resolution.normalizedAddress || normalizeText(originalAddress);
      return replacePrefix(normalizedAddress, resolution.matchedName, resolution.currentName);
    }

    function normalizeRegionForMatching(input) {
      var text = normalizeText(input);
      if (!text) return "";
      var resolved = resolveByAddress(text);
      if (resolved.resolved) return getCurrentAddress(text);
      for (var i = 0; i < aliasEntries.length; i += 1) {
        var alias = aliasEntries[i][0];
        var target = aliasEntries[i][1];
        if (text === alias || text.indexOf(alias + " ") === 0) {
          return target + text.slice(alias.length);
        }
      }
      return text;
    }

    function unresolved(reason, input) {
      return { resolved: false, reason: reason, input: toText(input) };
    }

    return {
      schemaVersion: toText(compatData.schemaVersion || currentData.schemaVersion),
      effectiveDate: toText(compatData.effectiveDate || currentData.effectiveDate),
      currentCount: currentByCode.size,
      mappingCount: mappingByLegacyCode.size,
      resolveByCode: resolveByCode,
      resolveByAddress: resolveByAddress,
      getBcodeCandidates: getBcodeCandidates,
      analyzePnu: analyzePnu,
      getPnuCandidates: getPnuCandidates,
      getAddressCandidates: getAddressCandidates,
      getCurrentAddress: getCurrentAddress,
      normalizeRegionForMatching: normalizeRegionForMatching
    };
  }

  async function load(options) {
    options = options || {};
    var fetchImpl = options.fetch || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    if (!fetchImpl) throw new Error("fetch is unavailable; pass { fetch } or use createResolver() with loaded JSON");
    var currentUrl = options.currentUrl || DEFAULT_CURRENT_URL;
    var compatUrl = options.compatUrl || DEFAULT_COMPAT_URL;
    var results = await Promise.all([fetchJson(fetchImpl, currentUrl), fetchJson(fetchImpl, compatUrl)]);
    return createResolver({ currentData: results[0], compatData: results[1] });
  }

  async function fetchJson(fetchImpl, url) {
    var response = await fetchImpl(url, { cache: "no-store" });
    if (!response || !response.ok) {
      throw new Error("Failed to load region data: " + url + " (" + (response ? response.status : "no response") + ")");
    }
    return response.json();
  }

  return {
    DEFAULT_CURRENT_URL: DEFAULT_CURRENT_URL,
    DEFAULT_COMPAT_URL: DEFAULT_COMPAT_URL,
    createResolver: createResolver,
    load: load
  };
});
