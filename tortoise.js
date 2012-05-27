tortoise = (function (undefined) {
    var breaker = {};

    var builtinFunctions = {
        'alert': function (msg) {
            alert(msg);
            return msg;
        }
    };

    var isArray = function (obj) {
        return obj && obj instanceof Array;
    };

    var eval = function (string, env) {
        return evalTortoise(tortoiseParser.parse(string), env);
    };

    var evalTortoise = function (stmts, env) {
        if (env && !env.bindings) env = { bindings: env };
        if (!env) env = { bindings: {} }
        env.outer = {
            bindings: builtinFunctions
        };

        var tmp = evalStatements(stmts, env);

        return isArray(tmp) && tmp[0] === breaker ? tmp[1] : tmp;
    };

    var lookupBinding = function (env, v) {
        if (!env) throw('Variable not defined: ' + v);
        if (v in env.bindings) {
			var tmp = env.bindings[v];

			return typeof tmp === 'function' ? tmp : +tmp;
		}
        return lookupBinding(env.outer, v);
    };

    var updateBinding = function (env, v, val) {
        if (!env) throw('Symbol not defined: ' + v);
        if (v in env.bindings) {
			if (typeof env.bindings[v] !== typeof val) throw('Cannot update symbol: ' + v);
			return env.bindings[v] = val;
		}
        return updateBinding(env.outer, v, val);
    };

    var addBinding = function (env, v, val) {
        if (v in env.bindings) throw('Symbol already defined: ' + v);
        return env.bindings[v] = val;
    };

    var addBindingExt = function (v, val) {
        if (v in builtinFunctions) throw('Symbol already defined: ' + v);
        return builtinFunctions[v] = val;
    };

    var evalStatements = function (stmts, env) {
        var val = undefined, tmp;

        for (var i = 0; i < stmts.length; i++) {
            tmp = evalStatement(stmts[i], env);
            if (isArray(tmp) && tmp[0] === breaker) return tmp;
            val = tmp;
        }
        return val;
    };

    var evalStatement = function (stmt, env) {
		var tmp, tmp2, i;
	
        switch(stmt.tag) {
            // A single expression
            case 'ignore':
                return evalExpr(stmt.body, env);

            // Variable declaration
            case 'var':
                tmp = stmt.body ? evalExpr(stmt.body, env) : 0;
                addBinding(env, stmt.name, tmp);
                return tmp;

            // Const declaration
            case 'const':
                tmp = stmt.body ? evalExpr(stmt.body, env) : 0;
                addBinding(env, stmt.name, '' + tmp);
                return tmp;

            // Function declaration
            case 'define':
				tmp = stmt.args;
                addBinding(env, stmt.name, function () {
                    var newEnv = {
                        outer: env,
                        bindings: { }
                    };
                    var result;

                    for (i = 0; i < tmp.length; ++i) newEnv.bindings[tmp[i]] = arguments[i];
                    result = evalStatements(stmt.body, newEnv);
                    return isArray(result) && result[0] === breaker ? result[1] : result;
                });
                return undefined;

            // Assignment
            case ':=':
                return updateBinding(env, stmt.left, evalExpr(stmt.right, env));

            // If/Else
            case 'if':
                if (evalExpr(stmt.expr, env)) {
                    tmp = evalStatements(stmt.body, env);
                }
                else if (stmt.body2) {
                    tmp = evalStatements(stmt.body2, env);
                }
                else {
                    tmp = undefined;
                }
                return tmp;

            // Repeat
            case 'repeat':
                tmp = evalExpr(stmt.expr, env);
                if (tmp > 0) {
					for (i = 1; i < tmp; ++i) tmp2 = evalStatements(stmt.body, env);
                }
                else {
                    tmp2 = undefined;
                }
                return tmp2;

            // While
            case 'while':
				tmp2 = undefined;
				while (evalExpr(stmt.expr, env)) tmp2 = evalStatements(stmt.body, env);
                return tmp2;

            // Return
            case 'return':
                return [breaker, evalExpr(stmt.expr, env)];
        }
    };

    var evalExpr = function (expr, env) {
        // Numbers evaluate to themselves
        if (typeof expr === 'number') return expr;

        var tmp, tmp2, i, len;

        switch (expr.tag) {
            // Special

            case 'undef':
                return undefined;

            case 'ident':
                tmp = lookupBinding(env, expr.name);
                if (typeof tmp === 'function') throw('Variable expected: ' + expr.name);
                return +tmp;

            case 'call':
                tmp = lookupBinding(env, expr.name);
                if (typeof tmp !== 'function') throw('Function expected: ' + expr.name);
                tmp2 = [];
                len = expr.args.length;
                for (i = 0; i < len; ++i) tmp2[i] = evalExpr(expr.args[i], env);
                return tmp.apply(null, tmp2);

            // Unary operators

            case '!':
                return evalExpr(expr.arg, env) === 0 ? 1 : 0;

            case 'neg':
                return -evalExpr(expr.arg, env);

            // Binary operators

            case '+':
                return evalExpr(expr.left, env) + evalExpr(expr.right, env);

            case '-':
                return evalExpr(expr.left, env) - evalExpr(expr.right, env);

            case '*':
                return evalExpr(expr.left, env) * evalExpr(expr.right, env);

            case '/':
                tmp = evalExpr(expr.right, env);
                if (tmp === 0) throw('Division by zero');
                return evalExpr(expr.left, env) / tmp;

            case '%':
                tmp = evalExpr(expr.right, env);
                if (tmp === 0) throw('Division by zero');
                return evalExpr(expr.left, env) % tmp;

            case '**':
                tmp = evalExpr(expr.left, env);
                tmp2 = evalExpr(expr.right, env);
                return tmp2 === 0 ? 1 : tmp && Math.pow(tmp, tmp2);

            case '==':
                return evalExpr(expr.left, env) === evalExpr(expr.right, env) ? 1 : 0;

            case '!=':
                return evalExpr(expr.left, env) !== evalExpr(expr.right, env) ? 1 : 0;

            case '<':
                return evalExpr(expr.left, env) < evalExpr(expr.right, env) ? 1 : 0;

            case '>':
                return evalExpr(expr.left, env) > evalExpr(expr.right, env) ? 1 : 0;

            case '<=':
                return evalExpr(expr.left, env) <= evalExpr(expr.right, env) ? 1 : 0;

            case '>=':
                return evalExpr(expr.left, env) >= evalExpr(expr.right, env) ? 1 : 0;

            case '&&':
                return evalExpr(expr.left, env) && evalExpr(expr.right, env);

            case '||':
                return evalExpr(expr.left, env) || evalExpr(expr.right, env);

            // Ternary operators

            case '? :':
                return evalExpr(expr.left, env) ? evalExpr(expr.middle, env) : evalExpr(expr.right, env);

            case '< <':
                tmp = evalExpr(expr.middle, env);
                return evalExpr(expr.left, env) < tmp && tmp < evalExpr(expr.right, env) ? 1 : 0;

            case '< <=':
                tmp = evalExpr(expr.middle, env);
                return evalExpr(expr.left, env) < tmp && tmp <= evalExpr(expr.right, env) ? 1 : 0;

            case '<= <':
                tmp = evalExpr(expr.middle, env);
                return evalExpr(expr.left, env) <= tmp && tmp < evalExpr(expr.right, env) ? 1 : 0;

            case '<= <=':
                tmp = evalExpr(expr.middle, env);
                return evalExpr(expr.left, env) <= tmp && tmp <= evalExpr(expr.right, env) ? 1 : 0;

            case '> >':
                tmp = evalExpr(expr.middle, env);
                return evalExpr(expr.left, env) > tmp && tmp > evalExpr(expr.right, env) ? 1 : 0;

            case '> >=':
                tmp = evalExpr(expr.middle, env);
                return evalExpr(expr.left, env) > tmp && tmp >= evalExpr(expr.right, env) ? 1 : 0;

            case '>= >':
                tmp = evalExpr(expr.middle, env);
                return evalExpr(expr.left, env) >= tmp && tmp > evalExpr(expr.right, env) ? 1 : 0;

            case '>= >=':
                tmp = evalExpr(expr.middle, env);
                return evalExpr(expr.left, env) >= tmp && tmp >= evalExpr(expr.right, env) ? 1 : 0;
        }
    };

    return {
        eval: eval,
        evalTortoise: evalTortoise,
        addBinding: addBindingExt
    };
})();